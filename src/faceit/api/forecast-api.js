/*
 * Copyright (c) 2025 TerraMiner. All Rights Reserved.
 */
const baseUrlFC = "https://api.fforecast.net"

async function fetchFC(url, errorMsg) {
    const res = await fetch(url);

    if (!res.ok) throw new Error(`${errorMsg}: ${res.statusText}`);

    const text = await res.text();
    try {
        return text ? JSON.parse(text) : null;
    } catch (err) {
        error(err)
        error(`${errorMsg}: invalid JSON`);
    }
}

async function fetchPing() {
    await fetchFC(`${baseUrlFC}/session/ping`, "Error on pinging");
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

            sendBannerMetric(parsed.bannerId, language,slot);

            return parsed;
        } catch (e) {
            error("Failed to parse cached banner data:", e);
        }
    }

    try {
        const res = await fetch(`${baseUrlFC}/integrations/banner?lang=${language}&slot=${slot}`);

        if (res.status === 204) return null;

        if (!res.ok) {
            error(`Failed to fetch banner: ${res.statusText}`);
            return null;
        }

        const bannerData = await res.json();

        setCookie("forecast-banner-cache", JSON.stringify(bannerData), 5);

        return bannerData;
    } catch (err) {
        error("Error fetching banner:", err);
        return null;
    }
}

async function sendBannerMetric(bannerId, language, slot) {
    try {
        await fetch(`${baseUrlFC}/integrations/banner?metricOnly=true&bannerId=${bannerId}&lang=${language}&slot=${slot}`, {
            method: 'GET'
        });
    } catch (err) {
        error(err)
    }
}