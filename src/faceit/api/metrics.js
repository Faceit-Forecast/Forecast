/*
 * Copyright (c) 2025 TerraMiner. All Rights Reserved.
 */

const METRICS_TOKEN_STORAGE_KEY = 'forecast-metrics-jwt';
const METRICS_ENROLL_FLAG_KEY = 'forecast-metrics-enrolled';
const METRICS_DEFAULT_INTERVAL_MS = 60_000;
const METRICS_MIN_INTERVAL_MS = 15_000;
const METRICS_MAX_INTERVAL_MS = 10 * 60_000;
const METRICS_JITTER_RATIO = 0.15;
const METRICS_TOKEN_BACKOFF_MS = 15 * 60_000;

let _metricsTimer = null;
let _metricsInFlight = false;
let _metricsRunning = false;

function _cfgMetrics() {
    const enabled = ep('apiQueue.metrics.enabled');
    const intervalMs = ep('apiQueue.metrics.intervalMs');
    return {
        enabled: enabled !== false,
        intervalMs: _clampInterval(intervalMs)
    };
}

function _clampInterval(ms) {
    if (typeof ms !== 'number' || !isFinite(ms)) return METRICS_DEFAULT_INTERVAL_MS;
    return Math.min(Math.max(ms, METRICS_MIN_INTERVAL_MS), METRICS_MAX_INTERVAL_MS);
}

function _jitter(base) {
    const delta = base * METRICS_JITTER_RATIO;
    return Math.round(base + (Math.random() * 2 - 1) * delta);
}

async function _storageGet(key) {
    return new Promise((resolve) => {
        try {
            CLIENT_STORAGE.get([key], (r) => resolve(r?.[key]));
        } catch (e) {
            resolve(undefined);
        }
    });
}

async function _storageSet(obj) {
    return new Promise((resolve) => {
        try {
            CLIENT_STORAGE.set(obj, () => resolve(true));
        } catch (e) {
            resolve(false);
        }
    });
}

async function _ensureEnrolled(deviceId, apiBase) {
    const already = await _storageGet(METRICS_ENROLL_FLAG_KEY);
    if (already) return true;

    try {
        const res = await fetch(`${apiBase}/v1/metrics/faceit-api/enroll`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                deviceId,
                extVersion: EXTENSION_VERSION,
                browser: BROWSER_TYPE
            })
        });
        if (res.ok) {
            await _storageSet({ [METRICS_ENROLL_FLAG_KEY]: Date.now() });
            return true;
        }
        if (res.status === 409) {
            await _storageSet({ [METRICS_ENROLL_FLAG_KEY]: Date.now() });
            return true;
        }
    } catch (e) {}
    return false;
}

let _metricsTokenInFlight = null;
let _metricsTokenCooldownUntil = 0;

async function _getToken(deviceId, apiBase) {
    const cached = await _storageGet(METRICS_TOKEN_STORAGE_KEY);
    if (cached && cached.token && cached.expiresAt && cached.expiresAt - 60_000 > Date.now()) {
        return cached.token;
    }

    if (Date.now() < _metricsTokenCooldownUntil) return null;
    if (_metricsTokenInFlight) return _metricsTokenInFlight;

    _metricsTokenInFlight = (async () => {
        try {
            const res = await fetch(`${apiBase}/v1/metrics/faceit-api/token`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ deviceId })
            });
            if (res.status === 429) {
                const ra = parseInt(res.headers.get('Retry-After'), 10);
                const backoff = (isFinite(ra) && ra > 0) ? ra * 1000 : METRICS_TOKEN_BACKOFF_MS;
                _metricsTokenCooldownUntil = Date.now() + backoff;
                return null;
            }
            if (!res.ok) return null;
            const data = await res.json();
            if (!data || !data.token || !data.expiresAt) return null;
            _metricsTokenCooldownUntil = 0;
            await _storageSet({
                [METRICS_TOKEN_STORAGE_KEY]: { token: data.token, expiresAt: data.expiresAt }
            });
            return data.token;
        } catch (e) {
            return null;
        } finally {
            _metricsTokenInFlight = null;
        }
    })();

    return _metricsTokenInFlight;
}

async function _sendMetrics(snapshot, deviceId, token, apiBase) {
    const payload = {
        token,
        deviceId,
        nonce: _genNonce(),
        extVersion: EXTENSION_VERSION,
        browser: BROWSER_TYPE,
        useProxy: !!_useProxy,
        snapshot
    };

    const body = JSON.stringify(payload);

    try {
        const res = await fetch(`${apiBase}/v1/metrics/faceit-api/ingest`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body,
            keepalive: true
        });
        if (res.status === 401 || res.status === 403) {
            await _storageSet({ [METRICS_TOKEN_STORAGE_KEY]: null });
        }
    } catch (e) {
    }
}

async function _tick() {
    if (_metricsInFlight) return;
    _metricsInFlight = true;
    try {
        const cfg = _cfgMetrics();
        if (!cfg.enabled) return;

        const snapshot = apiQueue.getAndResetStats();
        if (!snapshot || snapshot.requests === 0) return;

        const deviceId = await getDeviceId();
        if (!deviceId) return;

        const apiBase = await getApiUrl();
        if (!apiBase) return;

        const enrolled = await _ensureEnrolled(deviceId, apiBase);
        if (!enrolled) return;

        const token = await _getToken(deviceId, apiBase);
        if (!token) return;

        await _sendMetrics(snapshot, deviceId, token, apiBase);
    } catch (e) {
    } finally {
        _metricsInFlight = false;
    }
}

function _schedule() {
    if (_metricsTimer) {
        clearTimeout(_metricsTimer);
        _metricsTimer = null;
    }
    const cfg = _cfgMetrics();
    if (!cfg.enabled) return;
    const delay = _jitter(cfg.intervalMs);
    _metricsTimer = setTimeout(async () => {
        await _tick();
        _schedule();
    }, delay);
}

function _flushBeacon() {
    try {
        const snapshot = apiQueue.getAndResetStats();
        if (!snapshot || snapshot.requests === 0) return;

        (async () => {
            const deviceId = await getDeviceId();
            if (!deviceId) return;
            const apiBase = await getApiUrl();
            if (!apiBase) return;
            const cached = await _storageGet(METRICS_TOKEN_STORAGE_KEY);
            const token = cached?.token;
            if (!token) return;

            const payload = JSON.stringify({
                token,
                deviceId,
                nonce: _genNonce(),
                extVersion: EXTENSION_VERSION,
                browser: BROWSER_TYPE,
                useProxy: !!_useProxy,
                snapshot
            });
            const url = `${apiBase}/v1/metrics/faceit-api/ingest`;
            try {
                const blob = new Blob([payload], { type: 'text/plain' });
                navigator.sendBeacon(url, blob);
            } catch (e) {}
        })();
    } catch (e) {}
}

function startMetricsReporter() {
    if (_metricsRunning) return;
    _metricsRunning = true;

    _schedule();

    if (typeof window !== 'undefined') {
        window.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') _flushBeacon();
        });
        window.addEventListener('pagehide', _flushBeacon);
    }
}

const SELECTOR_METRICS_DEFAULT_INTERVAL_MS = 5 * 60_000;
let _selMetricsTimer = null;
let _selMetricsInFlight = false;
let _selMetricsRunning = false;
let _selMetricsSampledIn = null;

function _cfgSelMetrics() {
    const enabled = mpOpt('selectorMetrics.enabled') === true;
    const rawInterval = mpOpt('selectorMetrics.intervalMs');
    const intervalMs = (typeof rawInterval === 'number' && isFinite(rawInterval))
        ? _clampInterval(rawInterval) : SELECTOR_METRICS_DEFAULT_INTERVAL_MS;
    const rawSample = mpOpt('selectorMetrics.sampleRate');
    const sampleRate = (typeof rawSample === 'number' && rawSample >= 0 && rawSample <= 1) ? rawSample : 0;
    return { enabled, intervalMs, sampleRate };
}

async function _isSelMetricsSampledIn(sampleRate) {
    if (sampleRate >= 1) return true;
    if (sampleRate <= 0) return false;
    const deviceId = await getDeviceId();
    if (!deviceId) return false;
    let h = 0;
    for (let i = 0; i < deviceId.length; i++) h = (h * 31 + deviceId.charCodeAt(i)) | 0;
    return (Math.abs(h) % 10000) / 10000 < sampleRate;
}

async function _selTick() {
    if (_selMetricsInFlight) return;
    _selMetricsInFlight = true;
    try {
        const cfg = _cfgSelMetrics();
        if (!cfg.enabled) return;

        if (_selMetricsSampledIn === null) _selMetricsSampledIn = await _isSelMetricsSampledIn(cfg.sampleRate);
        if (!_selMetricsSampledIn) return;

        const deviceId = await getDeviceId();
        if (!deviceId) return;
        const apiBase = await getApiUrl();
        if (!apiBase) return;

        const enrolled = await _ensureEnrolled(deviceId, apiBase);
        if (!enrolled) return;
        const token = await _getToken(deviceId, apiBase);
        if (!token) return;

        const snapshot = getSelectorMetricsSnapshot(true);
        if (!snapshot || Object.keys(snapshot).length === 0) return;

        await _sendSelectorMetrics(snapshot, deviceId, token, apiBase);
    } catch (e) {
    } finally {
        _selMetricsInFlight = false;
    }
}

async function _sendSelectorMetrics(snapshot, deviceId, token, apiBase) {
    const payload = JSON.stringify({
        token,
        deviceId,
        nonce: _genNonce(),
        extVersion: EXTENSION_VERSION,
        browser: BROWSER_TYPE,
        snapshot
    });
    try {
        const res = await fetch(`${apiBase}/v1/metrics/selectors/ingest`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: payload,
            keepalive: true
        });
        if (res.status === 401 || res.status === 403) {
            await _storageSet({ [METRICS_TOKEN_STORAGE_KEY]: null });
        }
    } catch (e) {}
}

function _selSchedule() {
    if (_selMetricsTimer) {
        clearTimeout(_selMetricsTimer);
        _selMetricsTimer = null;
    }
    const cfg = _cfgSelMetrics();

    if (!cfg.enabled) {
        _selMetricsTimer = setTimeout(_selSchedule, 60_000);
        return;
    }
    const delay = _jitter(cfg.intervalMs);
    _selMetricsTimer = setTimeout(async () => {
        await _selTick();
        _selSchedule();
    }, delay);
}

function startSelectorMetricsReporter() {
    if (_selMetricsRunning) return;
    _selMetricsRunning = true;
    _selSchedule();
}

const SETTINGS_METRICS_LAST_REPORT_KEY = 'settings-metrics-last-report';
const SETTINGS_METRICS_DEFAULT_EPOCH_MS = 24 * 60 * 60_000;
const SETTINGS_METRICS_CHECK_MS = 10 * 60_000;
let _settingsMetricsTimer = null;
let _settingsMetricsRunning = false;
let _settingsMetricsSampledIn = null;

function _genNonce() {
    try {
        return crypto.randomUUID();
    } catch (e) {
        return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12);
    }
}

async function _isSampledIn(sampleRate, salt) {
    if (sampleRate >= 1) return true;
    if (sampleRate <= 0) return false;
    const deviceId = await getDeviceId();
    if (!deviceId) return false;
    const s = (salt || '') + deviceId;
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    return (Math.abs(h) % 10000) / 10000 < sampleRate;
}

function _cfgSettingsMetrics() {
    const enabled = mpOpt('settingsMetrics.enabled') === true;
    const rawSample = mpOpt('settingsMetrics.sampleRate');
    const sampleRate = (typeof rawSample === 'number' && rawSample >= 0 && rawSample <= 1) ? rawSample : 0;
    const rawEpoch = mpOpt('settingsMetrics.epochMs');
    const epochMs = (typeof rawEpoch === 'number' && rawEpoch >= 5_000) ? rawEpoch : SETTINGS_METRICS_DEFAULT_EPOCH_MS;
    const schema = mpOpt('settingsMetrics.schema');
    return { enabled, sampleRate, epochMs, schema: Array.isArray(schema) ? schema : [] };
}

function _settingsBucketLabel(v, buckets) {
    if (!Array.isArray(buckets) || buckets.length === 0) return String(Math.round(v));
    for (let i = 0; i < buckets.length; i++) {
        if (v < buckets[i]) {
            return i === 0 ? ('<' + buckets[0]) : (buckets[i - 1] + '-' + (buckets[i] - 1));
        }
    }
    return buckets[buckets.length - 1] + '+';
}

function _settingsKeyMatches(k, entry) {
    if (entry.suffix) return k.endsWith(entry.suffix);
    if (entry.prefix) return k.startsWith(entry.prefix);
    return false;
}

function _transformSetting(entry, all) {
    switch (entry.type) {
        case 'bool': {
            let v = all[entry.key];
            if (v === undefined) v = entry.default;
            if (v === undefined) return undefined;
            return v ? 'on' : 'off';
        }
        case 'enum': {
            let v = all[entry.key];
            if (v === undefined || v === null) v = entry.default;
            if (v === undefined || v === null) return undefined;
            const vs = String(v);
            return (Array.isArray(entry.values) && entry.values.includes(vs)) ? vs : 'other';
        }
        case 'number': {
            let raw = all[entry.key];
            if (raw === undefined && entry.default !== undefined) raw = entry.default;
            const n = Number(raw);
            if (!isFinite(n)) return undefined;
            return _settingsBucketLabel(n, entry.buckets);
        }
        case 'presence': {
            const v = all[entry.key];
            return (typeof v === 'string' && v.trim() !== '') ? 'set' : 'unset';
        }
        case 'presenceAny': {
            const match = Object.keys(all).some(k =>
                _settingsKeyMatches(k, entry) && typeof all[k] === 'string' && all[k].trim() !== '');
            return match ? 'set' : 'unset';
        }
        default:
            return undefined;
    }
}

async function _buildSettingsSnapshot(schema) {
    const all = await new Promise((resolve) => {
        try {
            CLIENT_STORAGE_SYNC.get(null, (r) => resolve(r || {}));
        } catch (e) {
            resolve({});
        }
    });
    const snapshot = {};
    for (const entry of schema) {
        if (!entry || !entry.metricKey || !entry.type) continue;
        const val = _transformSetting(entry, all);
        if (val !== undefined) snapshot[entry.metricKey] = val;
    }
    return snapshot;
}

async function _sendSettingsMetrics(snapshot, deviceId, token, apiBase) {
    const payload = JSON.stringify({
        token,
        deviceId,
        nonce: _genNonce(),
        extVersion: EXTENSION_VERSION,
        browser: BROWSER_TYPE,
        snapshot
    });
    try {
        const res = await fetch(`${apiBase}/v1/metrics/settings/ingest`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: payload,
            keepalive: true
        });
        if (res.status === 401 || res.status === 403) {
            await _storageSet({ [METRICS_TOKEN_STORAGE_KEY]: null });
        }
    } catch (e) {}
}

async function _settingsTick() {
    try {
        const cfg = _cfgSettingsMetrics();
        if (!cfg.enabled || cfg.schema.length === 0) return;

        if (_settingsMetricsSampledIn === null) _settingsMetricsSampledIn = await _isSampledIn(cfg.sampleRate, 'settings');
        if (!_settingsMetricsSampledIn) return;

        const last = await _storageGet(SETTINGS_METRICS_LAST_REPORT_KEY);
        if (last && (Date.now() - last) < cfg.epochMs) return;

        const deviceId = await getDeviceId();
        if (!deviceId) return;
        const apiBase = await getApiUrl();
        if (!apiBase) return;
        const enrolled = await _ensureEnrolled(deviceId, apiBase);
        if (!enrolled) return;
        const token = await _getToken(deviceId, apiBase);
        if (!token) return;

        const snapshot = await _buildSettingsSnapshot(cfg.schema);
        if (Object.keys(snapshot).length === 0) return;

        await _sendSettingsMetrics(snapshot, deviceId, token, apiBase);
        await _storageSet({ [SETTINGS_METRICS_LAST_REPORT_KEY]: Date.now() });
    } catch (e) {}
}

function _settingsSchedule() {
    if (_settingsMetricsTimer) {
        clearTimeout(_settingsMetricsTimer);
        _settingsMetricsTimer = null;
    }
    _settingsMetricsTimer = setTimeout(async () => {
        await _settingsTick();
        _settingsSchedule();
    }, SETTINGS_METRICS_CHECK_MS);
}

function startSettingsMetricsReporter() {
    if (_settingsMetricsRunning) return;
    _settingsMetricsRunning = true;
    setTimeout(() => _settingsTick(), 15_000);
    _settingsSchedule();
}
