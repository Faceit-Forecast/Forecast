/*
 * Copyright (c) 2025 TerraMiner. All Rights Reserved.
 */

const METRICS_TOKEN_STORAGE_KEY = 'forecast-metrics-jwt';
const METRICS_ENROLL_FLAG_KEY = 'forecast-metrics-enrolled';
const METRICS_DEFAULT_INTERVAL_MS = 60_000;
const METRICS_MIN_INTERVAL_MS = 15_000;
const METRICS_MAX_INTERVAL_MS = 10 * 60_000;
const METRICS_JITTER_RATIO = 0.15;

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

async function _getToken(deviceId, apiBase) {
    const cached = await _storageGet(METRICS_TOKEN_STORAGE_KEY);
    if (cached && cached.token && cached.expiresAt && cached.expiresAt - 60_000 > Date.now()) {
        return cached.token;
    }

    try {
        const res = await fetch(`${apiBase}/v1/metrics/faceit-api/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ deviceId })
        });
        if (!res.ok) return null;
        const data = await res.json();
        if (!data || !data.token || !data.expiresAt) return null;
        await _storageSet({
            [METRICS_TOKEN_STORAGE_KEY]: { token: data.token, expiresAt: data.expiresAt }
        });
        return data.token;
    } catch (e) {
        return null;
    }
}

async function _sendMetrics(snapshot, deviceId, token, apiBase) {
    const payload = {
        token,
        deviceId,
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
