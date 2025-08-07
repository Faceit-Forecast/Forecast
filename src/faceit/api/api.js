/*
 * Copyright (c) 2025 TerraMiner. All Rights Reserved.
 */

const baseUrlV4 = "https://open.faceit.com/data/v4";

const playerDataCache = new Map();
const playerGamesDataCache = new Map();
const matchDataCache = new Map();
const oldMatchDataCache = new Map();
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
    let param = latestMatchTime !== 0 ? `&to=${latestMatchTime}` : "";
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

async function fetchOldMatchStats(matchId) {
    let cachedData = oldMatchDataCache.get(matchId)
    if (cachedData) return cachedData

    const apiKey = getApiKey();
    const url = `https://api.faceit.com/match/v2/match/${matchId}`;
    const options = {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        credentials: 'include',
    };

    const response = await fetch(url, options);
    if (!response.ok) {
        error(`Error: ${response.statusText}`);
    }

    return (await response.json())["payload"];
}

function extractPlayerNick() {
    const nick = window.location.href.match(/players\/([a-zA-Z0-9-_.]+)/);
    return nick ? nick[1] : null;
}

function extractGameType() {
    const match = window.location.href.match(/stats\/([a-zA-Z0-9-_]+)/);
    if (match) return match[1];
    const fallbackMatch = window.location.href.match(/\/([a-zA-Z0-9-_]+)\/room/);
    return fallbackMatch ? fallbackMatch[1] : null;
}

function extractMatchId() {
    const match = window.location.href.match(/room\/([a-z0-9-]+)/i);
    return match ? match[1] : null;
}

function extractLanguage() {
    const url = window.location.href;
    const match = url.match(/https:\/\/www\.faceit\.com\/([^/]+)\/?/);
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
    for (let i = 0; i < cookies.length; i++) {
        let cookie = cookies[i].trim();
        if (cookie.indexOf(nameEQ) === 0) {
            return decodeURIComponent(cookie.substring(nameEQ.length));
        }
    }
    return null;
}

