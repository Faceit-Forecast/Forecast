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