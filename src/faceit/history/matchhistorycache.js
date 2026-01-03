/*
 * Copyright (c) 2025 TerraMiner. All Rights Reserved.
 */

const forecastCacheKeyPrefix = "forecast-matchhistory"
const cookieCacheId = "last-matchhistorycache-cleanup";
const cleanUpPeriod = 86400000;
const maxUnusedHours = 48;
const CACHE_VERSION = 5;

const DB_NAME = 'faceit_matches';
const STORE_NAME = 'matches';
const DB_VERSION = 1;

const cacheMap = new Map();
let db = null;

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

function calculatePerformanceRating(stats, totalRounds, playerElo = null, teamContext = null) {
    const kills = parseInt(stats.Kills) || 0;
    const assists = parseInt(stats.Assists) || 0;
    const deaths = parseInt(stats.Deaths) || 0;
    const adr = parseFloat(stats.ADR) || 0;
    const kd = parseFloat(stats["K/D Ratio"]) || 0;

    const firstKills = parseInt(stats["First Kills"]) || 0;
    const entryCount = parseInt(stats["Entry Count"]) || 0;
    const entryWins = parseInt(stats["Entry Wins"]) || 0;
    const matchEntryRate = parseFloat(stats["Match Entry Rate"]) || 0;
    const matchEntrySuccessRate = parseFloat(stats["Match Entry Success Rate"]) || 0;

    const clutchKills = parseInt(stats["Clutch Kills"]) || 0;
    const v1Wins = parseInt(stats["1v1Wins"]) || 0;
    const v1Count = parseInt(stats["1v1Count"]) || 0;
    const v2Wins = parseInt(stats["1v2Wins"]) || 0;
    const v2Count = parseInt(stats["1v2Count"]) || 0;

    const doubleKills = parseInt(stats["Double Kills"]) || 0;
    const tripleKills = parseInt(stats["Triple Kills"]) || 0;
    const quadroKills = parseInt(stats["Quadro Kills"]) || 0;
    const pentaKills = parseInt(stats["Penta Kills"]) || 0;

    const utilityDamage = parseFloat(stats["Utility Damage"]) || 0;
    const utilityCount = parseInt(stats["Utility Count"]) || 0;
    const utilitySuccesses = parseInt(stats["Utility Successes"]) || 0;

    const flashCount = parseInt(stats["Flash Count"]) || 0;
    const flashSuccesses = parseInt(stats["Flash Successes"]) || 0;
    const enemiesFlashed = parseInt(stats["Enemies Flashed"]) || 0;
    const mvps = parseInt(stats.MVPs) || 0;

    const rounds = totalRounds;
    const kpr = kills / rounds;
    const apr = assists / rounds;
    const dpr = deaths / rounds;

    const kprScore = Math.min(Math.pow(kpr / 0.75, 1.1), 1.0);
    const kdScore = Math.pow(Math.min(Math.max(kd, 0.3) / 1.1, 1.3), 1.3);
    const adrScore = Math.pow(Math.min(adr / 85, 1.2), 1.15);

    const deathPenalty = dpr > 0.7 ? Math.pow(Math.max(0.4, 1 - (dpr - 0.7) * 1.2), 1.1) : 1.0;

    const multiKillBonus = Math.min(
        (doubleKills * 0.03 + tripleKills * 0.1 + quadroKills * 0.25 + pentaKills * 0.5) / rounds,
        0.2
    );

    const fraggingImpact = (kprScore * 0.35 + kdScore * 0.40 + adrScore * 0.25) * deathPenalty * (1 + multiKillBonus) * 100;

    const firstKillRate = firstKills / rounds;
    const firstKillScore = Math.min(Math.pow(firstKillRate / 0.25, 1.1), 1.0);

    const entryWinRate = entryCount > 0 ? entryWins / entryCount : 0;
    const entryScore = entryCount > 0
        ? (matchEntryRate * 0.25 + matchEntrySuccessRate * 0.45 + entryWinRate * 0.30)
        : 0;

    const v1Rate = v1Count > 0 ? v1Wins / v1Count : 0;
    const v2Rate = v2Count > 0 ? v2Wins / v2Count : 0;
    const clutchScore = Math.min((clutchKills / rounds) * 3.5 + v1Rate * 0.6 + v2Rate * 1.0, 1.0);

    const entryClutch = (firstKillScore * 0.40 + entryScore * 0.35 + clutchScore * 0.25) * 100;

    const utilDamagePerRound = utilityDamage / rounds;
    const utilDamageScore = Math.min(Math.pow(utilDamagePerRound / 4.5, 0.9), 1.0);
    const utilEfficiency = utilityCount > 0 ? Math.min(utilitySuccesses / utilityCount, 1.0) : 0;
    const flashEfficiency = flashCount > 0 ? Math.min(flashSuccesses / flashCount, 1.0) : 0;

    const utilityUsage = (utilDamageScore * 0.50 + utilEfficiency * 0.25 + flashEfficiency * 0.25) * 100;

    const assistScore = Math.min(Math.pow(apr / 0.22, 0.95), 1.0);
    const flashTeamScore = enemiesFlashed > 0 ? Math.min(Math.pow((enemiesFlashed / rounds) / 0.45, 0.9), 1.0) : 0;
    const mvpScore = Math.min(Math.pow((mvps / rounds) / 0.18, 1.05), 1.0);

    const teamplay = (assistScore * 0.40 + flashTeamScore * 0.30 + mvpScore * 0.30) * 100;

    let baseRating = fraggingImpact * 0.55 + entryClutch * 0.20 + utilityUsage * 0.13 + teamplay * 0.12;

    if (teamContext && playerElo && teamContext.effectiveEnemyElo) {
        const avgTeamADR = teamContext.avgADR || 75;
        const avgTeamKD = teamContext.avgKD || 1.0;

        const adrRatio = adr / Math.max(avgTeamADR, 30);
        const kdRatio = kd / Math.max(avgTeamKD, 0.5);
        const relativePerformance = (adrRatio * 0.6 + kdRatio * 0.4);

        const eloDiff = playerElo - teamContext.effectiveEnemyElo;
        const eloAdjustment = 1 - (eloDiff / 2000) * 0.12;
        const eloMultiplier = Math.max(0.80, Math.min(1.20, eloAdjustment));

        const teamAdjustment = Math.pow(relativePerformance, 0.7);
        baseRating = baseRating * teamAdjustment * eloMultiplier;
    }

    const normalizedRating = Math.max(0, baseRating * 0.95);

    return {
        performanceRating: normalizedRating.toFixed(1),
        fraggingImpact: fraggingImpact.toFixed(1),
        entryClutch: entryClutch.toFixed(1),
        utilityUsage: utilityUsage.toFixed(1),
        teamplay: teamplay.toFixed(1)
    };
}

async function getFromCacheOrFetch(key, fetchDetailedStats, fetchV3Stats = null) {
    if (!db) await initDB();
    const cacheKey = `${forecastCacheKeyPrefix}::${key}`;

    if (cacheMap.has(cacheKey)) {
        const cachedData = cacheMap.get(cacheKey);
        if (cachedData.version === CACHE_VERSION) {
            const hasValidData = cachedData.data.rounds?.[0]?.teams?.every(team =>
                team.players.every(p => p.player_stats !== undefined && p.elo !== null)
            );
            if (hasValidData) {
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
            const hasValidData = cached.data.rounds?.[0]?.teams?.every(team =>
                team.players.every(p => p.player_stats !== undefined && p.elo !== null)
            );
            if (hasValidData) {
                cached.lastUsed = Date.now();
                cacheMap.set(cacheKey, cached);
                await updateLastUsed(key, cached.lastUsed);
                return cached.data;
            }
        }
    } catch (err) {
        error('Error reading from IndexedDB:', err);
    }

    const detailedStats = await fetchDetailedStats(key);
    if (!detailedStats?.rounds?.[0]) return null;

    let v3Stats = null;
    if (fetchV3Stats) {
        try {
            v3Stats = await fetchV3Stats(key);
        } catch (e) {}
    }

    const eloMap = new Map();
    const teamEloArrays = [[], []];

    if (v3Stats?.[0]?.teams) {
        v3Stats[0].teams.forEach((team, teamIdx) => {
            team.players.forEach(player => {
                eloMap.set(player.playerId, player.elo);
                if (player.elo) {
                    teamEloArrays[teamIdx].push(player.elo);
                }
            });
        });
    }

    const matchRound = detailedStats.rounds[0];
    const totalRounds = parseInt(matchRound.round_stats.Rounds) || 0;

    const teamsData = matchRound.teams.map((team, teamIndex) => {
        const teamStats = team.players.map(p => {
            const s = p.player_stats;
            return {
                adr: parseFloat(s.ADR) || 0,
                kd: parseFloat(s["K/D Ratio"]) || 0
            };
        });

        const avgADR = teamStats.reduce((sum, p) => sum + p.adr, 0) / teamStats.length;
        const avgKD = teamStats.reduce((sum, p) => sum + p.kd, 0) / teamStats.length;

        const enemyTeamIndex = teamIndex === 0 ? 1 : 0;
        const enemyElos = teamEloArrays[enemyTeamIndex];

        let effectiveEnemyElo = null;
        if (enemyElos.length >= 3) {
            const sortedEnemyElos = [...enemyElos].sort((a, b) => b - a);
            const topThree = sortedEnemyElos.slice(0, 3);
            const topThreeAvg = topThree.reduce((sum, elo) => sum + elo, 0) / topThree.length;

            const sortedForMedian = [...enemyElos].sort((a, b) => a - b);
            const medianEnemyElo = sortedForMedian[Math.floor(sortedForMedian.length / 2)];

            effectiveEnemyElo = topThreeAvg * 0.7 + medianEnemyElo * 0.3;
        }

        return {
            teamIndex,
            avgADR,
            avgKD,
            effectiveEnemyElo,
            players: team.players
        };
    });

    const teamsWithRawRatings = teamsData.map(teamData => {
        const playersWithRawRatings = teamData.players.map(player => {
            const stats = player.player_stats;
            const playerElo = eloMap.get(player.player_id);

            const teamContext = teamData.effectiveEnemyElo ? {
                avgADR: teamData.avgADR,
                avgKD: teamData.avgKD,
                effectiveEnemyElo: teamData.effectiveEnemyElo
            } : null;

            const ratings = calculatePerformanceRating(stats, totalRounds, playerElo, teamContext);

            return {
                player,
                playerElo,
                stats,
                rawRating: parseFloat(ratings.performanceRating) || 0,
                fraggingImpact: ratings.fraggingImpact,
                entryClutch: ratings.entryClutch,
                utilityUsage: ratings.utilityUsage,
                teamplay: ratings.teamplay
            };
        });

        const totalRawRating = playersWithRawRatings.reduce((sum, p) => sum + p.rawRating, 0);

        return {
            teamData,
            playersWithRawRatings,
            totalRawRating
        };
    });

    const cachedValue = {
        matchId: key,
        data: {
            rounds: [{
                teams: teamsWithRawRatings.map(({ teamData, playersWithRawRatings, totalRawRating }) => ({
                    players: playersWithRawRatings.map(({ player, playerElo, stats, rawRating, fraggingImpact, entryClutch, utilityUsage, teamplay }) => {
                        const normalizedRating = totalRawRating > 0
                            ? (rawRating / totalRawRating * 100).toFixed(1)
                            : "0.0";

                        return {
                            nickname: player.nickname,
                            player_id: player.player_id,
                            elo: playerElo ?? null,
                            player_stats: {
                                "Kills": stats.Kills || "0",
                                "Assists": stats.Assists || "0",
                                "Deaths": stats.Deaths || "0",
                                "ADR": (parseFloat(stats.ADR) || 0).toFixed(1),
                                "K/D Ratio": (parseFloat(stats["K/D Ratio"]) || 0).toFixed(2),
                                "K/R Ratio": (parseFloat(stats["K/R Ratio"]) || 0).toFixed(2),
                                "Headshots": stats.Headshots || "0",
                                "Headshots %": (parseFloat(stats["Headshots %"]) || 0).toFixed(0),
                                "MVPs": stats.MVPs || "0",
                                "Rating": normalizedRating,
                                "Impact Score": fraggingImpact,
                                "Entry/Clutch": entryClutch,
                                "Utility": utilityUsage,
                                "Teamplay": teamplay,
                            }
                        };
                    }),
                    team_stats: {
                        "Team Win": matchRound.teams[teamData.teamIndex].team_stats["Team Win"] || "0",
                        "Final Score": matchRound.teams[teamData.teamIndex].team_stats["Final Score"] || "0"
                    }
                })),
                round_stats: {
                    "Rounds": matchRound.round_stats.Rounds || "0",
                    "Score": matchRound.round_stats.Score || "",
                    "Map": matchRound.round_stats.Map || ""
                }
            }]
        },
        cacheDate: Date.now(),
        lastUsed: Date.now(),
        version: CACHE_VERSION
    };

    saveToDb(cachedValue).catch(err => error('Error saving to IndexedDB:', err));
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