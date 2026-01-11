/*
 * Copyright (c) 2025 TerraMiner. All Rights Reserved.
 */
const baseUrlFC = "https://api.fforecast.net"

let cachedDeviceId = null;

async function getDeviceId() {
    if (cachedDeviceId) return cachedDeviceId;

    return new Promise((resolve) => {
        CLIENT_API.storage.local.get(['deviceId'], async (result) => {
            if (result.deviceId) {
                cachedDeviceId = result.deviceId;
                resolve(result.deviceId);
            } else {
                const newDeviceId = await registerDevice();
                if (newDeviceId) {
                    cachedDeviceId = newDeviceId;
                    CLIENT_API.storage.local.set({ deviceId: newDeviceId });
                }
                resolve(newDeviceId);
            }
        });
    });
}

async function registerDevice() {
    try {
        const res = await fetch(`${baseUrlFC}/v2/extension/register`, {
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
    await fetchFC(`${baseUrlFC}/v2/extension/ping`);
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
    const cachedData = getCookie(`forecast-banner-cache-${language}-${slot}`);
    if (cachedData) {
        try {
            const parsed = JSON.parse(cachedData);
            sendBannerMetric(parsed.bannerId, language, slot);
            return parsed;
        } catch (e) {
            error("Failed to parse cached banner data:", e);
        }
    }

    const bannerData = await fetchFC(`${baseUrlFC}/v2/integrations/banner?lang=${language}&slot=${slot}`);

    if (bannerData) {
        setCookie("forecast-banner-cache", JSON.stringify(bannerData), 5);
    }

    return bannerData;
}

async function sendBannerMetric(bannerId, language, slot) {
    await fetchFC(`${baseUrlFC}/v2/integrations/banner?metricOnly=true&bannerId=${bannerId}&lang=${language}&slot=${slot}`);
}