/*
 * Copyright (c) 2025 TerraMiner. All Rights Reserved.
 */

let baseUrlV3 = "https://www.faceit.com/api/stats/v3";
let baseUrlV4 = "https://open.faceit.com/data/v4";
let _useProxy = false;

function initApiEndpoints() {
    const v3 = ep('faceit.baseUrlV3');
    const v4 = ep('faceit.baseUrlV4');
    if (v3) baseUrlV3 = v3;
    if (v4) baseUrlV4 = v4;

    const useProxy = ep('faceit.useProxy');
    const proxyBaseUrl = ep('faceit.proxyBaseUrl');
    if (useProxy && proxyBaseUrl) {
        _useProxy = true;
        baseUrlV3 = proxyBaseUrl + '/v3';
        baseUrlV4 = proxyBaseUrl + '/v4';
    }
}

class ApiQueue {
    constructor(rps) {
        this.interval = 1000 / rps;
        this.queues = new Map();
    }

    getEndpointKey(url) {
        try {
            const u = new URL(url);
            const path = u.pathname
                .replace(/\/1-[a-f0-9-]{36}/g, '/{id}')
                .replace(/\/[a-f0-9-]{36}/g, '/{id}')
                .replace(/\/[a-f0-9]{20,}/g, '/{id}');
            return u.host + path;
        } catch {
            return 'default';
        }
    }

    getQueue(key) {
        if (!this.queues.has(key)) {
            this.queues.set(key, { pending: [], lastCall: 0, running: false });
        }
        return this.queues.get(key);
    }

    enqueue(url, fn) {
        const key = this.getEndpointKey(url);
        const queue = this.getQueue(key);

        return new Promise((resolve, reject) => {
            queue.pending.push({ fn, resolve, reject });
            this.process(key);
        });
    }

    async process(key) {
        const queue = this.getQueue(key);
        if (queue.running || queue.pending.length === 0) return;

        queue.running = true;

        while (queue.pending.length > 0) {
            const now = Date.now();
            const wait = Math.max(0, queue.lastCall + this.interval - now);

            if (wait > 0) await new Promise(r => setTimeout(r, wait));

            const { fn, resolve, reject } = queue.pending.shift();
            queue.lastCall = Date.now();

            fn().then(resolve, reject);
        }

        queue.running = false;
    }
}

const apiQueue = new ApiQueue(5);

const playerDataCache = new Map();
const playerGamesDataCache = new Map();
const matchDataCache = new Map();
const matchDataV3Cache = new Map();
const matchDataStatsCache = new Map();
const fetchInFlight = new Map();

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
    return apiQueue.enqueue(url, async () => {
        const headers = {
            'accept': acceptHeader,
            'accept-language': 'ru,en-US;q=0.9,en;q=0.8',
        };

        if (_useProxy) {
            headers['X-Extension-Version'] = EXTENSION_VERSION;
            const deviceId = await getDeviceId();
            if (deviceId) headers['X-Device-ID'] = deviceId;
        } else {
            headers['faceit-referer'] = 'web-next';
            headers['sec-fetch-dest'] = 'empty';
            headers['sec-fetch-mode'] = 'cors';
            headers['sec-fetch-site'] = 'same-origin';
        }

        const res = await fetch(url, {
            headers,
            credentials: _useProxy ? 'omit' : 'include'
        });

        if (!res.ok) {
            const errorText = await res.text();
            error(`${errorMsg}: ${res.status} ${res.statusText}. Response: ${errorText}`);
            return null;
        }

        return res.json();
    });
}

async function fetchV4(url, errorMsg) {
    return apiQueue.enqueue(url, async () => {
        const headers = { 'Content-Type': 'application/json' };

        if (_useProxy) {
            headers['X-Extension-Version'] = EXTENSION_VERSION;
            const deviceId = await getDeviceId();
            if (deviceId) headers['X-Device-ID'] = deviceId;
        } else {
            const apiKey = await resolveAccessToken();
            headers['Authorization'] = `Bearer ${apiKey}`;
        }

        const res = await fetch(url, {
            headers,
            credentials: _useProxy ? 'omit' : 'include'
        });

        if (!res.ok) {
            error(`${errorMsg}: ${res.statusText}`);
            return null;
        }
        return res.json();
    });
}

const fetchV3 = (url, errorMsg) => fetchInternal(url, errorMsg, 'application/json, text/plain, */*');

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

async function fetchCached(cache, url, errorMsg, fetchFn, localKey, ttlMinutes, fallbackUrl = null, validator = null) {
    if (cache.has(url)) {
        const memData = cache.get(url);
        if (!validator || validator(memData)) return memData;
        cache.delete(url);
    }

    const localData = await getLocalStorageCache(localKey);
    if (localData && (!validator || validator(localData))) {
        cache.set(url, localData);
        return localData;
    }

    if (fetchInFlight.has(url)) {
        return fetchInFlight.get(url);
    }

    const promise = (async () => {
        const data = fallbackUrl ? await fetchWithFallback(url, errorMsg, fallbackUrl) : await fetchFn(url, errorMsg);
        if (data != null) {
            cache.set(url, data);
            if (!validator || validator(data)) {
                await setLocalStorageCache(localKey, data, ttlMinutes);
            }
        }
        return data;
    })();

    fetchInFlight.set(url, promise);
    promise.finally(() => fetchInFlight.delete(url));

    return promise;
}

const fetchV4Cached = (cache, url, errorMsg, localKey, ttlMinutes, fallbackUrl) => fetchCached(cache, url, errorMsg, fetchV4, localKey, ttlMinutes, fallbackUrl);
const fetchV3Cached = (cache, url, errorMsg, localKey, ttlMinutes, validator = null) => fetchCached(cache, url, errorMsg, fetchV3, localKey, ttlMinutes, null, validator);

function v3EloValidator(data) {
    if (!data?.[0]?.teams) return false;
    return data[0].teams.some(team =>
        team.players.some(p => p.elo != null && p.elo > 0)
    );
}

async function fetchMatchStats(matchId) {
    return fetchV4Cached(
        matchDataCache,
        `${baseUrlV4}/matches/${matchId}`,
        `Error when retrieving match statistics by ID ${matchId}`,
        `match_${matchId}`,
        4320,
        `matches/${matchId}`
    );
}

async function fetchMatchStatsDetailed(matchId) {
    return fetchV4Cached(
        matchDataStatsCache,
        `${baseUrlV4}/matches/${matchId}/stats`,
        `Error when retrieving detailed match statistics by ID: ${matchId}`,
        `match_stats_${matchId}`,
        4320,
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
        5,
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
    const data = await fetchV4Cached(
        playerDataCache,
        url,
        `Error when requesting player data by nickname: ${nickname}`,
        `player_nick_${nickname}`,
        1,
        `players?nickname=${encodeURIComponent(nickname)}`
    );
    if (data && data.player_id) {
        const idUrl = `${baseUrlV4}/players/${data.player_id}`;
        if (!playerDataCache.has(idUrl)) {
            playerDataCache.set(idUrl, data);
        }
    }
    return data;
}

async function fetchV3MatchStats(matchId) {
    return fetchV3Cached(
        matchDataV3Cache,
        `${baseUrlV3}/matches/${matchId}`,
        `Error when retrieving V3 match statistics by ID: ${matchId}`,
        `match_v3_${matchId}`,
        4320,
        v3EloValidator
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

async function resolveAccessToken() {
    if (_useProxy) return null;
    const cached = await getLocalStorageCache('forecast-api-key');
    if (cached) return cached;

    // Try backend first
    try {
        const baseUrl = await getBaseUrlFC();
        const res = await fetch(`${baseUrl}/v1/faceit/access-token`);
        if (res.ok) {
            const token = (await res.text()).trim();
            if (token) {
                await setLocalStorageCache('forecast-api-key', token, 5);
                return token;
            }
        }
    } catch (e) {}

    // Fallback to GitHub
    const data = await fetch("https://raw.githubusercontent.com/Faceit-Forecast/Forecast/refs/heads/master/api-key");
    const token = (await data.text()).trim();
    await setLocalStorageCache('forecast-api-key', token, 5);
    return token;
}