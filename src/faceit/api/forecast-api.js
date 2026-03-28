/*
 * Copyright (c) 2025 TerraMiner. All Rights Reserved.
 */

async function getBaseUrlFC() {
    return await getApiUrl();
}

const userIdCache = new Map();

async function getDeviceId() {
    return new Promise((resolve) => {
        CLIENT_STORAGE.get(['deviceId'], async (result) => {
            if (result.deviceId) {
                resolve(result.deviceId);
            } else {
                const newDeviceId = await registerDevice();
                if (newDeviceId) {
                    CLIENT_STORAGE.set({ deviceId: newDeviceId });
                }
                resolve(newDeviceId);
            }
        });
    });
}

async function registerDevice() {
    try {
        const baseUrl = await getBaseUrlFC();
        const res = await fetch(`${baseUrl}/v2/extension/register`, {
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
        error("Failed to register device:", err);
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
        const res = await fetch(url, { ...options, headers });

        if (!res.ok) {
            if (res.status !== 204) {
                error(`Request failed: ${res.statusText}`);
            }
            return null;
        }

        const text = await res.text();
        return text ? JSON.parse(text) : null;
    } catch (err) {
        error(`Request error: ${err.message}`);
        return null;
    }
}

async function fetchPing() {
    const baseUrl = await getBaseUrlFC();
    await fetchFC(`${baseUrl}/v2/extension/ping`);
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


    const cached = await new Promise((resolve) => {
        CLIENT_STORAGE.get([cacheKey], (result) => {
            resolve(result[cacheKey]);
        });
    });

    if (cached && cached.data && cached.timestamp) {

        if (Date.now() - cached.timestamp < 5 * 60 * 1000) {
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
    }

    return bannerData;
}

async function sendBannerMetric(bannerId, language, slot) {
    const baseUrl = await getBaseUrlFC();
    await fetchFC(`${baseUrl}/v2/integrations/banner?metricOnly=true&bannerId=${bannerId}&lang=${language}&slot=${slot}`);
}

async function checkUserRegistered(faceitId) {
    let response = userIdCache[faceitId];

    if (response === undefined) {
        const baseUrl = await getBaseUrlFC();
        response = await fetchFC(`${baseUrl}/v1/auth/user?faceit_id=${encodeURIComponent(faceitId)}`);
        userIdCache[faceitId] = response;
    }

    return response?.authenticated === true;
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
