const baseUrlFC = "https://forecast.dargen.dev"

async function fetchFC(url, errorMsg) {
    const res = await fetch(url);

    if (!res.ok) throw new Error(`${errorMsg}: ${res.statusText}`);

    const text = await res.text();
    try {
        return text ? JSON.parse(text) : null;
    } catch (err) {
        throw new Error(`${errorMsg}: invalid JSON`);
    }
}

async function fetchBannerHtml() {
    try {
        const res = await fetch(`${baseUrlFC}/integrations/banner`);

        if (res.status === 204) return null;

        if (!res.ok) {
            console.error(`Failed to fetch banner: ${res.statusText}`);
            return null;
        }

        return await res.text();
    } catch (err) {
        console.error("Error fetching banner:", err);
        return null;
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

async function fetchBannerData() {
    try {
        const res = await fetch(`${baseUrlFC}/integrations/banner`);

        if (res.status === 204) return null;

        if (!res.ok) {
            console.error(`Failed to fetch banner: ${res.statusText}`);
            return null;
        }
        return await res.json();
    } catch (err) {
        console.error("Error fetching banner:", err);
        return null;
    }
}