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

    applyApiQueueConfig();
}

function applyApiQueueConfig() {
    const rps = ep('apiQueue.rps');
    if (typeof rps === 'number' && rps > 0 && rps <= 50) {
        apiQueue.setRps(rps);
    }
}

class ApiQueue {
    constructor(rps) {
        this.setRps(rps);
        this.pending = [];
        this.lastCall = 0;
        this.running = false;
        this.cooldownUntil = 0;
        this._resetStats();
    }

    setRps(rps) {
        this.rps = rps;
        this.interval = 1000 / rps;
    }

    _resetStats() {
        this.stats = {
            windowStart: Date.now(),
            requests: 0,
            status2xx: 0,
            status429: 0,
            status5xx: 0,
            networkErr: 0,
            retries: 0,
            cooldownHits: 0,
            queueDepthSamples: [],
            waitMsSamples: []
        };
    }

    recordStatus(code) {
        this.stats.requests++;
        if (code >= 200 && code < 300) this.stats.status2xx++;
        else if (code === 429) this.stats.status429++;
        else if (code >= 500 && code < 600) this.stats.status5xx++;
    }

    recordNetworkError() {
        this.stats.requests++;
        this.stats.networkErr++;
    }

    recordRetry() {
        this.stats.retries++;
    }

    recordCooldownHit() {
        this.stats.cooldownHits++;
    }

    getAndResetStats() {
        const now = Date.now();
        const snap = {
            ...this.stats,
            windowEnd: now,
            rpsCap: this.rps,
            queueDepthP50: _p(this.stats.queueDepthSamples, 50),
            queueDepthP95: _p(this.stats.queueDepthSamples, 95),
            waitMsP50: _p(this.stats.waitMsSamples, 50),
            waitMsP95: _p(this.stats.waitMsSamples, 95),
            sampleCount: this.stats.queueDepthSamples.length
        };
        delete snap.queueDepthSamples;
        delete snap.waitMsSamples;
        this._resetStats();
        return snap;
    }

    enqueue(url, fn, sessionId) {
        const enqueuedAt = Date.now();
        if (this.stats.queueDepthSamples.length < 2000) {
            this.stats.queueDepthSamples.push(this.pending.length);
        }
        return new Promise((resolve, reject) => {
            this.pending.push({ fn, resolve, reject, sessionId: sessionId ?? _currentApiSession, enqueuedAt });
            this.process();
        });
    }

    applyCooldown(ms) {
        const until = Date.now() + ms;
        if (until > this.cooldownUntil) this.cooldownUntil = until;
    }

    async process() {
        if (this.running || this.pending.length === 0) return;
        this.running = true;

        while (this.pending.length > 0) {
            const item = this.pending.shift();

            if (item.sessionId !== _currentApiSession) {
                item.resolve(null);
                continue;
            }

            const now = Date.now();
            const wait = Math.max(
                0,
                this.lastCall + this.interval - now,
                this.cooldownUntil - now
            );
            if (wait > 0) await new Promise(r => setTimeout(r, wait));

            if (item.sessionId !== _currentApiSession) {
                item.resolve(null);
                continue;
            }

            const fetchStart = Date.now();
            if (this.stats.waitMsSamples.length < 2000) {
                this.stats.waitMsSamples.push(fetchStart - item.enqueuedAt);
            }
            this.lastCall = fetchStart;
            try {
                const res = await item.fn();
                item.resolve(res);
            } catch (e) {
                item.reject(e);
            }
        }

        this.running = false;
    }

    cancelStale(currentSession) {
        this.pending = this.pending.filter(item => {
            if (item.sessionId !== currentSession) {
                item.resolve(null);
                return false;
            }
            return true;
        });
    }
}

function _p(arr, percentile) {
    if (!arr || arr.length === 0) return 0;
    const sorted = arr.slice().sort((a, b) => a - b);
    const idx = Math.min(sorted.length - 1, Math.floor((percentile / 100) * sorted.length));
    return sorted[idx];
}

const apiQueue = new ApiQueue(5);

let _currentApiSession = 0;

function bumpApiSession() {
    _currentApiSession++;
    apiQueue.cancelStale(_currentApiSession);
    apiQueue.cooldownUntil = 0;
    apiQueue.lastCall = 0;
    fetchInFlight.clear();
    return _currentApiSession;
}

function _sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

const API_MAX_RETRIES = 6;
const API_BASE_DELAY = 1000;
const API_MAX_RETRY_AFTER = 30000;
const API_MAX_BACKOFF = 15000;

function _parseRetryAfter(headerValue) {
    if (!headerValue) return null;
    const sec = parseFloat(headerValue);
    if (!isNaN(sec) && isFinite(sec)) {
        return Math.min(Math.max(sec * 1000, 0), API_MAX_RETRY_AFTER);
    }
    const dateMs = Date.parse(headerValue);
    if (!isNaN(dateMs)) {
        return Math.min(Math.max(dateMs - Date.now(), 0), API_MAX_RETRY_AFTER);
    }
    return null;
}

function _backoffDelay(attempt) {
    const exp = Math.min(API_BASE_DELAY * Math.pow(2, attempt), API_MAX_BACKOFF);
    return exp + Math.random() * 250;
}

async function _performRequestWithRetry(url, buildInit, errorMsg, mySession) {
    for (let attempt = 0; attempt <= API_MAX_RETRIES; attempt++) {
        if (mySession !== _currentApiSession) return null;

        if (attempt > 0) apiQueue.recordRetry();

        let res;
        try {
            res = await fetch(url, await buildInit());
        } catch (e) {
            if (mySession !== _currentApiSession) return null;
            apiQueue.recordNetworkError();
            if (attempt < API_MAX_RETRIES) {
                const wait = _backoffDelay(attempt);
                apiQueue.applyCooldown(wait);
                apiQueue.recordCooldownHit();
                await _sleep(wait);
                continue;
            }
            error(`${errorMsg}: network error ${e?.message || e}`);
            return null;
        }

        apiQueue.recordStatus(res.status);

        if (res.status === 429 || res.status === 502 || res.status === 503 || res.status === 504) {
            if (attempt >= API_MAX_RETRIES || mySession !== _currentApiSession) {
                error(`${errorMsg}: ${res.status} ${res.statusText}`);
                return null;
            }
            const parsed = _parseRetryAfter(res.headers.get('Retry-After'));
            const wait = parsed != null ? parsed : _backoffDelay(attempt);
            apiQueue.applyCooldown(wait);
            apiQueue.recordCooldownHit();
            await _sleep(wait);
            continue;
        }

        if (!res.ok) {
            const txt = await res.text().catch(() => '');
            error(`${errorMsg}: ${res.status} ${res.statusText}. Response: ${txt}`);
            return null;
        }

        return res.json();
    }
    return null;
}

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
    const mySession = _currentApiSession;
    const buildInit = async () => {
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

        return {
            headers,
            credentials: _useProxy ? 'omit' : 'include'
        };
    };

    return apiQueue.enqueue(url, () => _performRequestWithRetry(url, buildInit, errorMsg, mySession), mySession);
}

async function fetchV4(url, errorMsg) {
    const mySession = _currentApiSession;
    const buildInit = async () => {
        const headers = { 'Content-Type': 'application/json' };

        if (_useProxy) {
            headers['X-Extension-Version'] = EXTENSION_VERSION;
            const deviceId = await getDeviceId();
            if (deviceId) headers['X-Device-ID'] = deviceId;
        } else {
            const apiKey = await resolveAccessToken();
            headers['Authorization'] = `Bearer ${apiKey}`;
        }

        return {
            headers,
            credentials: _useProxy ? 'omit' : 'include'
        };
    };

    return apiQueue.enqueue(url, () => _performRequestWithRetry(url, buildInit, errorMsg, mySession), mySession);
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

const API_KEY_FRESH_TTL_MIN = 60 * 24;
const API_KEY_STALE_KEY = 'forecast-api-key-stale';

let _accessTokenInFlight = null;

async function resolveAccessToken() {
    if (_useProxy) return null;

    const cached = await getLocalStorageCache('forecast-api-key');
    if (cached) {
        return cached;
    }

    if (_accessTokenInFlight) return _accessTokenInFlight;

    _accessTokenInFlight = (async () => {
        const stale = await getStaleApiKey();

        const fetched = await fetchAccessTokenFromBackend();
        if (fetched) {
            await setLocalStorageCache('forecast-api-key', fetched, API_KEY_FRESH_TTL_MIN);
            await CLIENT_STORAGE.set({ [API_KEY_STALE_KEY]: fetched });
            return fetched;
        }

        if (stale) {
            return stale;
        }

        try {
            const data = await fetchWithTimeout(
                "https://raw.githubusercontent.com/Faceit-Forecast/Forecast/refs/heads/master/api-key",
                {},
                5000
            );
            if (data && data.ok) {
                const token = (await data.text()).trim();
                if (token) {
                    await setLocalStorageCache('forecast-api-key', token, API_KEY_FRESH_TTL_MIN);
                    await CLIENT_STORAGE.set({ [API_KEY_STALE_KEY]: token });
                    return token;
                }
            }
        } catch (e) {}

        return null;
    })();

    try {
        return await _accessTokenInFlight;
    } finally {
        _accessTokenInFlight = null;
    }
}

async function fetchAccessTokenFromBackend() {
    try {
        const baseUrl = await getBaseUrlFC();
        const res = await fetchWithTimeout(`${baseUrl}/v1/faceit/access-token`, {}, FC_FETCH_TIMEOUT_MS);
        if (res && res.ok) {
            const token = (await res.text()).trim();
            return token || null;
        }
    } catch (e) {}
    return null;
}

async function getStaleApiKey() {
    return new Promise((resolve) => {
        CLIENT_STORAGE.get([API_KEY_STALE_KEY], (result) => {
            resolve(result[API_KEY_STALE_KEY] || null);
        });
    });
}