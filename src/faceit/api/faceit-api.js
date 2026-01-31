/*
 * Copyright (c) 2025 TerraMiner. All Rights Reserved.
 */

const baseUrlV3 = "https://www.faceit.com/api/stats/v3";
const baseUrlV4 = "https://open.faceit.com/data/v4";

const playerDataCache = new Map();
const playerGamesDataCache = new Map();
const matchDataCache = new Map();
const matchDataV3Cache = new Map();
const matchDataStatsCache = new Map();

async function getLocalStorageCache(key) {
    try {
        const result = await CLIENT_STORAGE.get([key]);
        const item = result[key];
        if (!item) return null;
        if (Date.now() > item.expiry) {
            await CLIENT_STORAGE.remove([key]);
            return null;
        }
        return item.data;
    } catch (e) {
        return null;
    }
}

async function setLocalStorageCache(key, data, ttlMinutes) {
    try {
        const expiry = Date.now() + (ttlMinutes * 60 * 1000);
        await CLIENT_STORAGE.set({ [key]: { data, expiry } });
    } catch (e) {
    }
}

async function fetchInternal(url, errorMsg, acceptHeader = 'application/json, text/plain, */*') {
    const res = await fetch(url, {
        headers: {
            'accept': acceptHeader,
            'accept-language': 'ru,en-US;q=0.9,en;q=0.8',
            'faceit-referer': 'web-next',
            'sec-fetch-dest': 'empty',
            'sec-fetch-mode': 'cors',
            'sec-fetch-site': 'same-origin',
        },
        credentials: 'include'
    });

    if (!res.ok) {
        const errorText = await res.text();
        error(`${errorMsg}: ${res.status} ${res.statusText}. Response: ${errorText}`);
    }

    return res.json();
}

async function fetchV4(url, errorMsg) {
    const apiKey = await getApiKey();
    const res = await fetch(url, {
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        credentials: 'include'
    });

    if (!res.ok) error(`${errorMsg}: ${res.statusText}`);
    return res.json();
}

const fetchV3 = (url, errorMsg) => fetchInternal(url, errorMsg, 'application/json, text/plain, */*');

async function fetchCached(cache, url, errorMsg, fetchFn, localKey, ttlMinutes, fallbackUrl = null) {
    if (cache.has(url)) {
        return cache.get(url);
    }

    const localData = await getLocalStorageCache(localKey);
    if (localData) {
        cache.set(url, localData);
        return localData;
    }

    const data = fallbackUrl ? await fetchWithFallback(url, errorMsg, fallbackUrl) : await fetchFn(url, errorMsg);
    cache.set(url, data);
    await setLocalStorageCache(localKey, data, ttlMinutes);
    return data;
}

const fetchV4Cached = (cache, url, errorMsg, localKey, ttlMinutes, fallbackUrl) => fetchCached(cache, url, errorMsg, fetchV4, localKey, ttlMinutes, fallbackUrl);
const fetchV3Cached = (cache, url, errorMsg, localKey, ttlMinutes) => fetchCached(cache, url, errorMsg, fetchV3, localKey, ttlMinutes);

async function fetchMatchStats(matchId) {
    return fetchV4Cached(
        matchDataCache,
        `${baseUrlV4}/matches/${matchId}`,
        `Error when retrieving match statistics by ID ${matchId}`,
        `match_${matchId}`,
        2880,
        `matches/${matchId}`
    );
}

async function fetchMatchStatsDetailed(matchId) {
    return fetchV4Cached(
        matchDataStatsCache,
        `${baseUrlV4}/matches/${matchId}/stats`,
        `Error when retrieving detailed match statistics by ID: ${matchId}`,
        `match_stats_${matchId}`,
        2880,
        `matches/${matchId}/stats`
    );
}

async function fetchPlayerInGameStats(playerId, game, matchAmount = 30, to = 0, from = 0) {
    const param = to === 0 ? "" : `&to=${to}`;
    const param1 = from === 0 ? "" : `&from=${to}`;
    const url = `${baseUrlV4}/players/${playerId}/games/${game}/stats?limit=${matchAmount}${param}${param1}`;
    return fetchV4Cached(
        playerGamesDataCache,
        url,
        `Error when requesting player game data by ID: ${playerId}`,
        `player_games_${playerId}_${game}_${matchAmount}_${to}_${from}`,
        1,
        `players/${playerId}/games/${game}/stats?limit=${matchAmount}${param}${param1}`
    );
}

async function fetchPlayerStatsById(playerId) {
    return fetchV4Cached(
        playerDataCache,
        `${baseUrlV4}/players/${playerId}`,
        `Error when requesting player data by ID: ${playerId}`,
        `player_${playerId}`,
        5,
        `players/${playerId}`
    );
}

async function fetchPlayerStatsByNickName(nickname) {
    const url = `${baseUrlV4}/players?nickname=${encodeURIComponent(nickname)}`;
    return fetchV4Cached(
        playerDataCache,
        url,
        `Error when requesting player data by nickname: ${nickname}`,
        `player_nick_${nickname}`,
        1,
        `players?nickname=${encodeURIComponent(nickname)}`
    );
}

async function fetchV3MatchStats(matchId) {
    return fetchV3Cached(
        matchDataV3Cache,
        `${baseUrlV3}/matches/${matchId}`,
        `Error when retrieving V3 match statistics by ID: ${matchId}`,
        `match_v3_${matchId}`,
        2880
    );
}

function extractPlayerNick() {
    const nick = /players\/([a-zA-Z0-9-_.]+)/.exec(window.location.href);
    return nick ? nick[1] : null;
}

function extractGameType(def = null) {
    const patterns = [
        /stats\/([a-zA-Z0-9-_]+)/,
        /\/([a-zA-Z0-9-_]+)\/room/,
        /\/players\/[^/]+\/([a-zA-Z0-9-_]+)/
    ];

    for (const pattern of patterns) {
        const match = pattern.exec(window.location.href);
        if (match) return match[1];
    }

    return def;
}

function extractMatchId() {
    const match = /room\/([a-z0-9-]+)/i.exec(window.location.href);
    return match ? match[1] : null;
}

function extractLanguage() {
    const url = window.location.href;
    const match = /https:\/\/www\.faceit\.com\/([^/]+)\/?/.exec(url);
    return match ? match[1] : null;
}

async function getApiKey() {
    let apiKey = getCookie("forecast-api-key");
    if (!apiKey) {
        const data = await fetch("https://raw.githubusercontent.com/Faceit-Forecast/Forecast/refs/heads/master/api-key");
        apiKey = await data.text();
        setCookie("forecast-api-key", apiKey, 5);
    }
    return apiKey;
}

function setCookie(name, value, minutes) {
    const date = new Date();
    date.setTime(date.getTime() + (minutes * 60 * 1000));
    const expires = "expires=" + date.toUTCString();
    document.cookie = name + "=" + encodeURIComponent(value) + ";" + expires + ";path=/;domain=.faceit.com;secure";
}

function getCookie(name) {
    const nameEQ = name + "=";
    const cookies = document.cookie.split(';');
    for (const element of cookies) {
        let cookie = element.trim();
        if (cookie.startsWith(nameEQ)) {
            return decodeURIComponent(cookie.substring(nameEQ.length));
        }
    }
    return null;
}

async function fetchWithFallback(url, errorMsg, relativeFallbackUrl) {
    try {
        return await fetchV4(url, errorMsg);
    } catch (e) {
        console.warn(`Faceit API failed for ${url}, trying fallback`);
        const base = await ensureFallbackBaseUrl();
        if (!base) {
            throw e;
        }
        const fallbackUrl = base + relativeFallbackUrl;
        return await fetchFC(fallbackUrl);
    }
}