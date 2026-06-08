/*
 * Copyright (c) 2025 TerraMiner. All Rights Reserved.
 */

const CONFIG_CACHE_TTL = 1000 * 60 * 60 * 2;
const SELECTORS_CACHE_KEY = 'forecast-selectors-config';
const ENDPOINTS_CACHE_KEY = 'forecast-endpoints-config';
const METRICS_CACHE_KEY = 'forecast-metrics-config';
const SELECTORS_CONFIG_PATH = '/config/selectors.json';
const ENDPOINTS_CONFIG_PATH = '/config/endpoints.json';
const METRICS_CONFIG_PATH = '/config/metrics.json';
const CDN_FETCH_TIMEOUT_MS = 3000;

let _selectorsConfig = null;
let _endpointsConfig = null;
let _metricsConfig = null;
let _configLoadPromise = null;
let _metricsLoadPromise = null;

const _selectorMetrics = new Map();
const _selStringToPath = new Map();
const _selLastRecordAt = new Map();
const _SEL_STRING_MAP_CAP = 5000;
const _SEL_DEDUP_MS = 1000;

function _recordSelector(path, hit) {
    const now = Date.now();
    const last = _selLastRecordAt.get(path);
    if (last !== undefined && now - last < _SEL_DEDUP_MS) return;
    _selLastRecordAt.set(path, now);
    let m = _selectorMetrics.get(path);
    if (!m) { m = { attempts: 0, hits: 0 }; _selectorMetrics.set(path, m); }
    m.attempts++;
    if (hit) m.hits++;
}

function _tagSelString(selStr, path) {
    if (!selStr) return;
    if (_selStringToPath.size >= _SEL_STRING_MAP_CAP) _selStringToPath.clear();
    _selStringToPath.set(selStr, path);
}

function getSelectorMetricsSnapshot(reset) {
    const out = {};
    for (const [path, m] of _selectorMetrics) {
        out[path] = { attempts: m.attempts, hits: m.hits };
    }
    if (reset) _selectorMetrics.clear();
    return out;
}

async function _fetchWithTimeout(url, timeoutMs) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, { signal: controller.signal });
    } finally {
        clearTimeout(timeoutId);
    }
}

async function _loadBundledJson(relativePath) {
    try {
        const url = CLIENT_RUNTIME.getURL(relativePath);
        const response = await fetch(url);
        if (response.ok) return await response.json();
    } catch (e) {
        error('Failed to load bundled config: ' + relativePath, e);
    }
    return null;
}

async function _fetchRemoteConfig(path) {
    try {
        const cdnUrl = await getCdnUrl();
        const response = await _fetchWithTimeout(cdnUrl + path, CDN_FETCH_TIMEOUT_MS);
        if (response.ok) return await response.json();
        return null;
    } catch (e) {}

    try {
        const fallbackCdnUrl = isUsingFallback() ? 'https://cdn.fforecast.net' : 'https://cdn.fforecast.dev';
        const response = await _fetchWithTimeout(fallbackCdnUrl + path, CDN_FETCH_TIMEOUT_MS);
        if (response.ok) return await response.json();
    } catch (e) {}

    return null;
}

async function _getLocalConfig(key) {
    return new Promise((resolve) => {
        CLIENT_STORAGE.get([key], (result) => {
            resolve(result[key] || null);
        });
    });
}

async function _setLocalConfig(key, value) {
    return new Promise((resolve) => {
        CLIENT_STORAGE.set({ [key]: value }, resolve);
    });
}

async function _loadConfigWithFallback(cacheName, remotePath, bundledPath) {
    let resolved = null;

    try {
        const cached = await _getLocalConfig(cacheName);
        const cachedTime = await _getLocalConfig(`${cacheName}-time`);

        if (cached && cachedTime && (Date.now() - cachedTime < CONFIG_CACHE_TTL)) {
            resolved = cached;
        }
    } catch (e) {
        error('Config cache read failed', e);
    }

    if (!resolved) {
        const remote = await _fetchRemoteConfig(remotePath);
        if (remote) {
            try {
                await _setLocalConfig(cacheName, remote);
                await _setLocalConfig(`${cacheName}-time`, Date.now());
            } catch (e) {
                error('Config cache write failed', e);
            }
            resolved = remote;
        }
    }

    if (!resolved) {
        try {
            const cached = await _getLocalConfig(cacheName);
            if (cached) resolved = cached;
        } catch (e) {}
    }

    if (!resolved) return await _loadBundledJson(bundledPath);

    const bundled = await _loadBundledJson(bundledPath);
    if (bundled && typeof bundled.version === 'number' && (typeof resolved.version !== 'number' || bundled.version > resolved.version)) {
        return bundled;
    }

    return resolved;
}

async function loadConfigs() {
    if (_selectorsConfig && _endpointsConfig) return;

    if (_configLoadPromise) return _configLoadPromise;

    _configLoadPromise = (async () => {
        const [selectors, endpoints] = await Promise.all([
            _loadConfigWithFallback(SELECTORS_CACHE_KEY, SELECTORS_CONFIG_PATH, 'src/config/selectors.json'),
            _loadConfigWithFallback(ENDPOINTS_CACHE_KEY, ENDPOINTS_CONFIG_PATH, 'src/config/endpoints.json')
        ]);

        _selectorsConfig = selectors;
        _endpointsConfig = endpoints;

        _configLoadPromise = null;
    })();

    return _configLoadPromise;
}

function loadMetricsConfig() {
    if (_metricsConfig || _metricsLoadPromise) return _metricsLoadPromise;

    _metricsLoadPromise = (async () => {
        _metricsConfig = await _loadConfigWithFallback(METRICS_CACHE_KEY, METRICS_CONFIG_PATH, 'src/config/metrics.json');
        _metricsLoadPromise = null;
    })();

    return _metricsLoadPromise;
}

function _resolvePath(obj, path) {
    const parts = path.split('.');
    let current = obj;
    for (const part of parts) {
        if (current == null || typeof current !== 'object') return undefined;
        current = current[part];
    }
    return current;
}

function getSelector(path) {
    if (!_selectorsConfig) {
        error('Selectors config not loaded');
        return null;
    }
    const value = _resolvePath(_selectorsConfig, path);
    if (value === undefined) {
        error('Selector not found: ' + path);
        return null;
    }
    return value;
}

function getEndpoint(path) {
    if (!_endpointsConfig) {
        error('Endpoints config not loaded');
        return null;
    }
    const value = _resolvePath(_endpointsConfig, path);
    if (value === undefined) {
        error('Endpoint not found: ' + path);
        return null;
    }
    return value;
}

function sel(path, vars) {
    let value = getSelector(path);
    if (value && vars) {
        for (const [key, val] of Object.entries(vars)) {
            value = value.replaceAll('$' + key, val);
        }
    }
    if (value) _tagSelString(value, path);
    return value;
}

function idx(path, defaultValue) {
    if (!_selectorsConfig) return defaultValue;
    const value = _resolvePath(_selectorsConfig, path);
    if (value === undefined || value === null) return defaultValue;
    const num = Number(value);
    return isNaN(num) ? defaultValue : num;
}

function ep(path) {
    return getEndpoint(path);
}

function epOpt(path) {
    if (!_endpointsConfig) return undefined;
    return _resolvePath(_endpointsConfig, path);
}

function mpOpt(path) {
    if (!_metricsConfig) return undefined;
    return _resolvePath(_metricsConfig, path);
}

(function _installSelectorTelemetry() {
    try {
        if (typeof Element === 'undefined' || typeof Document === 'undefined') return;
        if (Element.prototype.__forecastSelTelemetry) return;
        Element.prototype.__forecastSelTelemetry = true;

        const elQS = Element.prototype.querySelector;
        const elQSA = Element.prototype.querySelectorAll;
        const docQS = Document.prototype.querySelector;
        const docQSA = Document.prototype.querySelectorAll;

        Element.prototype.querySelector = function (s) {
            const r = elQS.call(this, s);
            const path = _selStringToPath.get(s);
            if (path !== undefined) _recordSelector(path, r != null);
            return r;
        };
        Element.prototype.querySelectorAll = function (s) {
            const r = elQSA.call(this, s);
            const path = _selStringToPath.get(s);
            if (path !== undefined) _recordSelector(path, r != null && r.length > 0);
            return r;
        };
        Document.prototype.querySelector = function (s) {
            const r = docQS.call(this, s);
            const path = _selStringToPath.get(s);
            if (path !== undefined) _recordSelector(path, r != null);
            return r;
        };
        Document.prototype.querySelectorAll = function (s) {
            const r = docQSA.call(this, s);
            const path = _selStringToPath.get(s);
            if (path !== undefined) _recordSelector(path, r != null && r.length > 0);
            return r;
        };
    } catch (e) {}
})();

if (typeof window !== 'undefined') {
    window.forecastSelectorStats = function () {
        const snap = getSelectorMetricsSnapshot(false);
        const rows = Object.keys(snap).map((p) => {
            const a = snap[p].attempts, h = snap[p].hits;
            return { selector: p, attempts: a, hits: h, hitRate: a ? Math.round((100 * h) / a) + '%' : 'n/a' };
        }).sort((x, y) => (parseInt(x.hitRate) || 0) - (parseInt(y.hitRate) || 0));
        try { console.table(rows); } catch (e) { console.log(rows); }
        return rows;
    };
}
