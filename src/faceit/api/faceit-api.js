/*
 * Copyright (c) 2025 TerraMiner. All Rights Reserved.
 */

const baseUrlV4 = "https://open.faceit.com/data/v4";
const baseUrlV1 = "https://www.faceit.com/api/statistics/v1";

const playerDataCache = new Map();
const playerGamesDataCache = new Map();
const matchDataCache = new Map();
const matchDataV1Cache = new Map();
const matchDataStatsCache = new Map();

async function fetchV4(url, errorMsg) {
    const apiKey = await getApiKey();
    const res = await fetch(url, {
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        credentials: 'include'
    });

    if (!res.ok) throw new Error(`${errorMsg}: ${res.statusText}`);
    return res.json();
}

async function fetchV4Cached(cache, url, errorMsg) {
    return cache.get(url) || cache.set(url, await fetchV4(url, errorMsg)).get(url);
}


async function fetchV1(url, errorMsg) {
    const res = await fetch(url, {
        headers: {
            'accept': 'application/json+camelcase',
            'accept-language': 'ru,en;q=0.9',
            'faceit-referer': 'web-next',
            'sec-fetch-dest': 'empty',
            'sec-fetch-mode': 'cors',
            'sec-fetch-site': 'same-origin'
        },
        credentials: 'include'
    });

    if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`${errorMsg}: ${res.status} ${res.statusText}. Response: ${errorText}`);
    }

    return res.json();
}

async function fetchV1Cached(cache, url, errorMsg) {
    return cache.get(url) || cache.set(url, await fetchV1(url, errorMsg)).get(url);
}

async function fetchMatchStats(matchId) {
    return fetchV4Cached(
        matchDataCache,
        `${baseUrlV4}/matches/${matchId}`,
        "Error when retrieving match statistics"
    );
}

async function fetchMatchStatsDetailed(matchId) {
    return fetchV4Cached(
        matchDataStatsCache,
        `${baseUrlV4}/matches/${matchId}/stats`,
        "Error when retrieving detailed match statistics"
    );
}

async function fetchPlayerInGameStats(playerId, game, matchAmount = 30, latestMatchTime = 0) {
    let param = latestMatchTime === 0 ? "" : `&to=${latestMatchTime}`;
    return await fetchV4Cached(
        playerGamesDataCache,
        `${baseUrlV4}/players/${playerId}/games/${game}/stats?limit=${matchAmount}${param}`,
        "Error when requesting player game data"
    );
}

async function fetchPlayerStatsById(playerId) {
    return fetchV4Cached(
        playerDataCache,
        `${baseUrlV4}/players/${playerId}`,
        "Error when requesting player data by ID"
    );
}

async function fetchPlayerStatsByNickName(nickname) {
    return fetchV4Cached(
        playerDataCache,
        `${baseUrlV4}/players?nickname=${encodeURIComponent(nickname)}`,
        "Error when requesting player data by nickname"
    );
}


async function fetchV1MatchRoundStats(game, matchId, round = 1, statsType = 2) {
    return (await fetchV1Cached(
        matchDataV1Cache,
        `${baseUrlV1}/${game}/matches/${matchId}/match-rounds/${round}/scoreboard?statsType=${statsType}`,
        "Error when retrieving V1 match round statistics"
    )).payload;
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
    let apiKey = getCookie("forecast-api-key")
    if (!apiKey) {
        let data = await fetch("https://raw.githubusercontent.com/TerraMiner/Forecast/refs/heads/master/api-key")
        apiKey = await data.text()
        setCookie("forecast-api-key", apiKey, 5)
    }
    return apiKey
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

