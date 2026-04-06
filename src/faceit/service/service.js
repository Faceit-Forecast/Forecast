/*
 * Copyright (c) 2025 TerraMiner. All Rights Reserved.
 */

const PING_INTERVAL = 1000 * 60 * 2;
const PING_DEBOUNCE_KEY = 'forecast-last-ping-time';

async function debouncedPing() {
    const now = Date.now();
    const lastPing = parseInt(localStorage.getItem(PING_DEBOUNCE_KEY) || '0', 10);

    if (now - lastPing < PING_INTERVAL) return;

    localStorage.setItem(PING_DEBOUNCE_KEY, String(now));
    await fetchPing();
}

let pingIntervalId = null;

function startPingService() {
    debouncedPing();
    pingIntervalId = setInterval(() => debouncedPing(), PING_INTERVAL);
}
