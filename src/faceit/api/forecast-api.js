/*
 * Copyright (c) 2025 TerraMiner. All Rights Reserved.
 */

async function getBaseUrlFC() {
    return await getApiUrl();
}

const FC_FETCH_TIMEOUT_MS = 3000;

async function fetchWithTimeout(url, options = {}, timeoutMs = FC_FETCH_TIMEOUT_MS) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, { ...options, signal: controller.signal });
    } finally {
        clearTimeout(timeoutId);
    }
}

const userIdCache = new Map();

let _deviceRegisterInFlight = null;

async function getDeviceId() {
    return new Promise((resolve) => {
        CLIENT_STORAGE.get(['deviceId'], async (result) => {
            if (result.deviceId) {
                resolve(result.deviceId);
                return;
            }
            if (!_deviceRegisterInFlight) {
                _deviceRegisterInFlight = (async () => {
                    try {
                        const id = await registerDevice();
                        if (id) await CLIENT_STORAGE.set({ deviceId: id });
                        return id || null;
                    } finally {
                        _deviceRegisterInFlight = null;
                    }
                })();
            }
            resolve(await _deviceRegisterInFlight);
        });
    });
}

async function registerDevice() {
    try {
        const baseUrl = await getBaseUrlFC();
        const res = await fetchWithTimeout(`${baseUrl}/v2/extension/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Extension-Version': EXTENSION_VERSION
            },
            body: JSON.stringify({})
        });

        if (!res.ok) return null;

        const data = await res.json();
        return data.deviceId || null;
    } catch (err) {
        return null;
    }
}

async function fetchFC(url, options = {}) {
    try {
        const deviceId = await getDeviceId();
        const headers = options.headers || {};
        if (deviceId) {
            headers['X-Device-ID'] = deviceId;
        }
        headers['X-Extension-Version'] = EXTENSION_VERSION;
        const res = await fetchWithTimeout(url, { ...options, headers });

        if (!res.ok) {
            if (res.status !== 204) {
                error(`Request failed: ${res.statusText}`);
            }
            return null;
        }

        const text = await res.text();
        return text ? JSON.parse(text) : null;
    } catch (err) {
        return null;
    }
}

async function fetchPing() {
    const baseUrl = await getBaseUrlFC();
    const result = await fetchFC(`${baseUrl}/v2/extension/ping`);
    if (result && result.deviceInvalid) {
        CLIENT_STORAGE.remove(['deviceId']);
        const newDeviceId = await registerDevice();
        if (newDeviceId) {
            CLIENT_STORAGE.set({ deviceId: newDeviceId });
        }
    }
}

function sanitizeHtml(html) {
    const temp = document.createElement('div');
    temp.innerHTML = html;

    temp.querySelectorAll('script').forEach(el => el.remove());

    temp.querySelectorAll('*').forEach(el => {
        Array.from(el.attributes).forEach(attr => {
            if (attr.name.startsWith('on') || (attr.name === 'href' && attr.value.toLowerCase().startsWith('javascript:'))) {
                el.removeAttribute(attr.name);
            }
        });
    });

    return temp.innerHTML;
}

function isValidUrl(url) {
    try {
        const parsed = new URL(url);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
        return false;
    }
}

async function fetchBannerData(language, slot) {
    const cacheKey = `forecast-banner-cache-${language}-${slot}`;
    const FRESH_TTL_MS = 5 * 60 * 1000;

    const cached = await new Promise((resolve) => {
        CLIENT_STORAGE.get([cacheKey], (result) => {
            resolve(result[cacheKey]);
        });
    });

    if (cached && cached.data && cached.timestamp) {
        if (Date.now() - cached.timestamp < FRESH_TTL_MS) {
            sendBannerMetric(cached.data.bannerId, language, slot);
            return cached.data;
        }
    }

    const baseUrl = await getBaseUrlFC();
    const bannerData = await fetchFC(`${baseUrl}/v2/integrations/banner?lang=${language}&slot=${slot}`);

    if (bannerData) {
        CLIENT_STORAGE.set({
            [cacheKey]: {
                data: bannerData,
                timestamp: Date.now()
            }
        });
        return bannerData;
    }

    if (cached?.data) {
        sendBannerMetric(cached.data.bannerId, language, slot);
        return cached.data;
    }

    return null;
}

async function sendBannerMetric(bannerId, language, slot) {
    const baseUrl = await getBaseUrlFC();
    fetchFC(`${baseUrl}/v2/integrations/banner?metricOnly=true&bannerId=${bannerId}&lang=${language}&slot=${slot}`);
}

const REGISTERED_CACHE_KEY_PREFIX = 'forecast-user-registered-';
const REGISTERED_FRESH_TTL_MS = 60 * 60 * 1000;

async function checkUserRegistered(faceitId) {
    if (userIdCache.has(faceitId)) {
        return userIdCache.get(faceitId)?.authenticated === true;
    }

    const storageKey = REGISTERED_CACHE_KEY_PREFIX + faceitId;
    const cached = await new Promise((resolve) => {
        CLIENT_STORAGE.get([storageKey], (result) => resolve(result[storageKey]));
    });

    const now = Date.now();
    if (cached && cached.data && typeof cached.timestamp === 'number') {
        userIdCache.set(faceitId, cached.data);
        if (now - cached.timestamp > REGISTERED_FRESH_TTL_MS) {
            refreshUserRegistered(faceitId, storageKey);
        }
        return cached.data?.authenticated === true;
    }

    const fresh = await fetchUserRegistered(faceitId);
    if (fresh) {
        userIdCache.set(faceitId, fresh);
        CLIENT_STORAGE.set({ [storageKey]: { data: fresh, timestamp: now } });
        return fresh?.authenticated === true;
    }

    return false;
}

async function fetchUserRegistered(faceitId) {
    const baseUrl = await getBaseUrlFC();
    return await fetchFC(`${baseUrl}/v1/auth/user?faceit_id=${encodeURIComponent(faceitId)}`);
}

async function refreshUserRegistered(faceitId, storageKey) {
    try {
        const fresh = await fetchUserRegistered(faceitId);
        if (fresh) {
            userIdCache.set(faceitId, fresh);
            CLIENT_STORAGE.set({ [storageKey]: { data: fresh, timestamp: Date.now() } });
        }
    } catch (e) {}
}

async function getFallbackBaseUrl() {
    try {
        const baseUrl = await getBaseUrlFC();
        const res = await fetch(`${baseUrl}/v1/faceit/fallback_url`);
        if (res.ok) {
            return await res.text();
        }
    } catch (e) {}
    return null;
}

let fallbackBaseUrl;

async function ensureFallbackBaseUrl() {
    if (!fallbackBaseUrl) {
        fallbackBaseUrl = await getFallbackBaseUrl();
    }
    return fallbackBaseUrl;
}
