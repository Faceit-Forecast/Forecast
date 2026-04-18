/*
 * Copyright (c) 2025 TerraMiner. All Rights Reserved.
 */

function getMapsConfigPath() {
    return ep('cdn.paths.mapsConfig') || '/config/mappool.json';
}
const MAPS_CONFIG_CACHE_KEY = 'maps-config-cache';
const MAPS_CONFIG_CACHE_TTL = 1000 * 60 * 60 * 6;

async function _loadBundledMapsConfig() {
    try {
        const url = CLIENT_RUNTIME.getURL('src/config/mappool.json');
        const response = await fetch(url);
        if (response.ok) return await response.json();
    } catch (e) {}
    return null;
}

let mapsConfig = null;

async function loadMapsConfig() {
    if (mapsConfig) return mapsConfig;

    let resolved = null;

    try {
        const cached = await getSettingValue(MAPS_CONFIG_CACHE_KEY, null);
        const cachedTime = await getSettingValue(`${MAPS_CONFIG_CACHE_KEY}-time`, 0);

        if (cached && cachedTime && (Date.now() - cachedTime < MAPS_CONFIG_CACHE_TTL)) {
            resolved = cached;
        }
    } catch (e) {
        console.warn('Cache read failed:', e);
    }

    if (!resolved) {
        try {
            const cdnUrl = await getCdnUrl();
            const response = await fetch(cdnUrl + getMapsConfigPath());
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            resolved = await response.json();

            try {
                await setSettingValue(MAPS_CONFIG_CACHE_KEY, resolved);
                await setSettingValue(`${MAPS_CONFIG_CACHE_KEY}-time`, Date.now());
            } catch (e) {
                console.warn('Cache write failed:', e);
            }
        } catch (error) {
            try {
                const fallbackCdnUrl = isUsingFallback() ? 'https://cdn.fforecast.net' : 'https://cdn.fforecast.dev';
                const response = await fetch(fallbackCdnUrl + getMapsConfigPath());
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                resolved = await response.json();

                try {
                    await setSettingValue(MAPS_CONFIG_CACHE_KEY, resolved);
                    await setSettingValue(`${MAPS_CONFIG_CACHE_KEY}-time`, Date.now());
                } catch (e) {}
            } catch (fallbackError) {
                console.error('Failed to load maps config from CDN:', fallbackError);
            }
        }
    }

    if (!resolved) {
        try {
            const cached = await getSettingValue(MAPS_CONFIG_CACHE_KEY, null);
            if (cached) resolved = cached;
        } catch (e) {}
    }

    const bundled = await _loadBundledMapsConfig();

    if (!resolved) {
        mapsConfig = bundled || { maps: {} };
        return mapsConfig;
    }

    if (bundled && typeof bundled.version === 'number' && (typeof resolved.version !== 'number' || bundled.version > resolved.version)) {
        mapsConfig = bundled;
    } else {
        mapsConfig = resolved;
    }

    return mapsConfig;
}

function buildFaceitNameToMapId(config) {
    const result = {};
    if (config && config.maps) {
        Object.entries(config.maps).forEach(([mapId, mapData]) => {
            if (mapData.active && mapData.faceitName) {
                result[mapData.faceitName] = mapId;
            }
        });
    }
    return result;
}

const posCatcherModule = new Module("poscatcher", async () => {
    const config = await loadMapsConfig();
    const maps = buildFaceitNameToMapId(config);

    const matchId = extractMatchId();
    const cookieKey = `${matchId}_poscatched`
    if (getCookie(cookieKey)) return
    let anchorSelector = sel('poscatcher.anchor');
    let mapselector = sel('poscatcher.mapSelector');
    let chatSelector = sel('poscatcher.chatInput');

    posCatcherModule.doAfterNodeAppear(anchorSelector, () => {
        posCatcherModule.doAfterNodeAppear(mapselector, async (node) => {
            if (getCookie(cookieKey)) return
            const key = node.innerText.trim();
            if (!key) return;
            const mapPick = maps[key];
            if (!mapPick) return
            if (!await isSettingEnabled(`${mapPick}Enabled`, true)) return
            let message = await getSettingValue(`${mapPick}Message`, "")
            if (typeof message !== "string" || message.trim() === "") return
            posCatcherModule.doAfterAllNodeAppear(chatSelector, (chatInput) => {
                if (getCookie(cookieKey)) return
                chatInput.focus();

                const descriptor = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value');
                descriptor.set.call(chatInput, message);

                chatInput.dispatchEvent(new Event('input', {bubbles: true}));
                chatInput.dispatchEvent(new Event('change', {bubbles: true}));

                chatInput.dispatchEvent(new KeyboardEvent('keydown', {
                    key: 'Enter',
                    code: 'Enter',
                    keyCode: 13,
                    which: 13,
                    bubbles: true
                }));

                chatInput.dispatchEvent(new KeyboardEvent('keyup', {
                    key: 'Enter',
                    code: 'Enter',
                    keyCode: 13,
                    which: 13,
                    bubbles: true
                }));

                setCookie(cookieKey, 1, 1440)
            })
        })
    })
}, async () => {
})