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


async function fetchPing() {
    await fetchFC(`${baseUrlFC}/session/ping`, "Error on pinging");
}