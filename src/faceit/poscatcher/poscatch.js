/*
 * Copyright (c) 2025 TerraMiner. All Rights Reserved.
 */

const MAPS_CONFIG_URL = 'https://cdn.fforecast.net/config/maps-config.json';
const MAPS_CONFIG_CACHE_KEY = 'maps-config-cache';
const MAPS_CONFIG_CACHE_TTL = 1000 * 60 * 60 * 6;

const defaultMapsConfig = {
    maps: {
        de_dust2: { active: true, faceitName: "Dust2" },
        de_mirage: { active: true, faceitName: "Mirage" },
        de_nuke: { active: true, faceitName: "Nuke" },
        de_ancient: { active: true, faceitName: "Ancient" },
        de_anubis: { active: true, faceitName: "Anubis" },
        de_train: { active: false, faceitName: "Train" },
        de_inferno: { active: true, faceitName: "Inferno" },
        de_overpass: { active: true, faceitName: "Overpass" }
    }
};

let mapsConfig = null;

async function loadMapsConfig() {
    if (mapsConfig) return mapsConfig;

    try {
        const cached = await getSettingValue(MAPS_CONFIG_CACHE_KEY, null);
        const cachedTime = await getSettingValue(`${MAPS_CONFIG_CACHE_KEY}-time`, 0);

        if (cached && cachedTime && (Date.now() - cachedTime < MAPS_CONFIG_CACHE_TTL)) {
            mapsConfig = cached;
            return mapsConfig;
        }
    } catch (e) {
        console.warn('Cache read failed:', e);
    }

    try {
        const response = await fetch(MAPS_CONFIG_URL);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        mapsConfig = await response.json();

        try {
            await setSettingValue(MAPS_CONFIG_CACHE_KEY, mapsConfig);
            await setSettingValue(`${MAPS_CONFIG_CACHE_KEY}-time`, Date.now());
        } catch (e) {
            console.warn('Cache write failed:', e);
        }

        return mapsConfig;
    } catch (error) {
        console.error('Failed to load maps config, using default:', error);
        mapsConfig = defaultMapsConfig;
        return mapsConfig;
    }
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
    let anchorSelector = "[name=info] > div[class*=Overview__Stack] > div[class*=Ready__Container]"
    let mapselector = "[name=info] > div[class*=Overview__Stack] > div > div > div > div:nth-child(4) > div > div[class*=middleSlot] > div > div > span > span"
    let chatSelector = "div[class*=styles__ChatSidebarContainer] > div > div:nth-child(2) > div[class*=ChatSection__ChatContainer] > div > div > div > div > div[class*=styles__MessageInputContainer] > div[class*=styles__InputWrapper] > div > div[class*=StyledTextArea__TextAreaWrapper] > textarea"

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