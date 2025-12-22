/*
 * Copyright (c) 2025 TerraMiner. All Rights Reserved.
 */

const forecastCacheKeyPrefix = "forecast-matchhistory"
const cookieCacheId = "last-matchhistorycache-cleanup";
const cleanUpPeriod = 86400000;
const maxUnusedHours = 48;
const CACHE_VERSION = 3;

const DB_NAME = 'faceit_matches';
const STORE_NAME = 'matches';
const DB_VERSION = 1;

const cacheMap = new Map();
let db = null;

function findPlayerInV1Teams(matchStats, playerId) {
    const teams = matchStats?.cs2?.teams;
    if (!teams) return null;

    for (const team of teams) {
        const player = team.players?.find(p => p.playerId === playerId);
        if (player) return player;
    }

    return null;
}

function tryCleanCache() {
    let nextCleanUpTime = Number.parseInt(getCookie(cookieCacheId), 10);
    let currentTime = Date.now();
    if (!nextCleanUpTime || nextCleanUpTime > currentTime) {
        setCookie(cookieCacheId, currentTime + cleanUpPeriod, 1440);
        cleanCache();
    }
}

async function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            db = request.result;
            resolve(db);
        };

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                const store = db.createObjectStore(STORE_NAME, {keyPath: 'matchId'});
                store.createIndex('cacheDate', 'cacheDate');
                store.createIndex('lastUsed', 'lastUsed');
                store.createIndex('version', 'version');
            }
        };
    });
}

async function loadMatchHistoryCache() {
    if (!db) await initDB();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();

        request.onsuccess = () => {
            const matches = request.result;
            matches.forEach(match => {
                if (match.version === CACHE_VERSION) {
                    cacheMap.set(`${forecastCacheKeyPrefix}::${match.matchId}`, match);
                }
            });
            resolve();
        };

        request.onerror = () => reject(request.error);
    });
}

async function getFromCacheOrFetch(key, fetchV4, fetchV1 = null) {
    if (!db) await initDB();

    const cacheKey = `${forecastCacheKeyPrefix}::${key}`;

    if (cacheMap.has(cacheKey)) {
        const cachedData = cacheMap.get(cacheKey);

        if (cachedData.version === CACHE_VERSION) {
            const hasNullData = cachedData.data.rounds[0].teams.some(team =>
                team.players.some(p => p.player_stats["RWS"] === null || p.elo === null)
            );

            if (!hasNullData) {
                cachedData.lastUsed = Date.now();
                await updateLastUsed(key, cachedData.lastUsed);
                return cachedData.data;
            }
            cacheMap.delete(cacheKey);
        } else {
            cacheMap.delete(cacheKey);
        }
    }

    try {
        const cached = await getFromDB(key);
        if (cached?.version === CACHE_VERSION) {
            const hasNullData = cached.data.rounds[0].teams.some(team =>
                team.players.some(p => p.player_stats["RWS"] === null || p.elo === null)
            );

            if (!hasNullData) {
                cached.lastUsed = Date.now();
                cacheMap.set(cacheKey, cached);
                await updateLastUsed(key, cached.lastUsed);
                return cached.data;
            }
        }
    } catch (err) {
        error('Error reading from IndexedDB:', err);
    }

    const v4Stats = await fetchV4(key);
    const v1Stats = fetchV1 ? await fetchV1(key).catch(() => null) : null;

    const cachedValue = {
        matchId: key,
        data: {
            rounds: [{
                teams: v4Stats.rounds[0].teams.map(team => ({
                    players: team.players.map(player => {
                        const v1Player = v1Stats ? findPlayerInV1Teams(v1Stats, player.player_id) : null;
                        return {
                            nickname: player.nickname,
                            player_id: player.player_id,
                            elo: v1Player?.elo ?? null,
                            eloDelta: v1Player?.eloDelta ?? null,
                            player_stats: {
                                "Kills": player.player_stats.Kills,
                                "Assists": player.player_stats.Assists,
                                "Deaths": player.player_stats.Deaths,
                                "ADR": player.player_stats.ADR,
                                "K/D Ratio": player.player_stats["K/D Ratio"],
                                "K/R Ratio": player.player_stats["K/R Ratio"],
                                "Headshots": player.player_stats["Headshots"],
                                "Headshots %": player.player_stats["Headshots %"],
                                "MVPs": player.player_stats["MVPs"],
                                "RWS": v1Player?.total?.rws ?? null
                            }
                        };
                    }),
                    team_stats: {
                        "Team Win": team.team_stats["Team Win"],
                        "Final Score": team.team_stats["Final Score"]
                    }
                })),
                round_stats: {
                    "Rounds": v4Stats.rounds[0].round_stats.Rounds,
                    "Score": v4Stats.rounds[0].round_stats.Score,
                    "Map": v4Stats.rounds[0].round_stats.Map
                }
            }]
        },
        cacheDate: Date.now(),
        lastUsed: Date.now(),
        version: CACHE_VERSION
    };

    saveToDb(cachedValue).catch(err =>
        error('Error saving to IndexedDB:', err)
    );

    cacheMap.set(cacheKey, cachedValue);
    return cachedValue.data;
}

async function saveToDb(value) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put(value);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

async function getFromDB(key) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(key);

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function updateLastUsed(key, timestamp) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(key);

        request.onsuccess = () => {
            const data = request.result;
            if (data) {
                data.lastUsed = timestamp;
                store.put(data);
                resolve();
            }
        };
        request.onerror = () => reject(request.error);
    });
}

async function cleanCache() {
    if (!db) await initDB();

    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index('lastUsed');

    return new Promise((resolve, reject) => {
        const request = index.openCursor();
        const currentTime = Date.now();
        const unusedTimeout = maxUnusedHours * 60 * 60 * 1000;
        let deleteCount = 0;

        request.onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor) {
                const value = cursor.value;

                if ((currentTime - value.lastUsed) > unusedTimeout ||
                    value.version === undefined ||
                    value.version < CACHE_VERSION) {
                    store.delete(cursor.primaryKey);
                    cacheMap.delete(`${forecastCacheKeyPrefix}::${value.matchId}`);
                    deleteCount++;
                }
                cursor.continue();
            } else {
                let message = '';
                if (deleteCount > 0) {
                    message += `Deleted ${deleteCount} old or outdated entries from IndexedDB`;
                }
                if (message) println(message);
                resolve();
            }
        };

        request.onerror = () => reject(request.error);
    });
}

async function initializeMatchHistoryCache() {
    await initDB().then(() => {
        tryCleanCache();
        loadMatchHistoryCache();
    }).catch(error);
}

