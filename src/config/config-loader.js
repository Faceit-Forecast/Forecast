/*
 * Copyright (c) 2025 TerraMiner. All Rights Reserved.
 */

const CONFIG_CACHE_TTL = 1000 * 60 * 60 * 2; // 2 hours
const SELECTORS_CACHE_KEY = 'forecast-selectors-config';
const ENDPOINTS_CACHE_KEY = 'forecast-endpoints-config';
const SELECTORS_CONFIG_PATH = '/config/selectors.json';
const ENDPOINTS_CONFIG_PATH = '/config/endpoints.json';

let _selectorsConfig = null;
let _endpointsConfig = null;
let _configLoadPromise = null;

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
        const response = await fetch(cdnUrl + path);
        if (response.ok) return await response.json();
    } catch (e) {}

    try {
        const fallbackCdnUrl = isUsingFallback() ? 'https://cdn.fforecast.net' : 'https://cdn.fforecast.dev';
        const response = await fetch(fallbackCdnUrl + path);
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
    try {
        const cached = await _getLocalConfig(cacheName);
        const cachedTime = await _getLocalConfig(`${cacheName}-time`);

        if (cached && cachedTime && (Date.now() - cachedTime < CONFIG_CACHE_TTL)) {
            return cached;
        }
    } catch (e) {
        error('Config cache read failed', e);
    }

    const remote = await _fetchRemoteConfig(remotePath);
    if (remote) {
        try {
            await _setLocalConfig(cacheName, remote);
            await _setLocalConfig(`${cacheName}-time`, Date.now());
        } catch (e) {
            error('Config cache write failed', e);
        }
        return remote;
    }

    try {
        const cached = await _getLocalConfig(cacheName);
        if (cached) return cached;
    } catch (e) {}

    return await _loadBundledJson(bundledPath);
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
    return value;
}

function ep(path) {
    return getEndpoint(path);
}
