/*
 * Copyright (c) 2025 TerraMiner. All Rights Reserved.
 */
const matchRoomModule = new Module("matchroom", async () => {
    matchRoomModule.teamCache = new Map()
    matchRoomModule.temporaryFaceitBugFix();
    const matchId = extractMatchId();

    try {
        if (!matchId) return;
        getMatchWinRates(matchId);
    } catch (err) {
        error("Error when retrieving match statistics", err);
    }
}, async () => {
    matchRoomModule.teamCache.clear()
})

async function getMapIconUrl(mapName, size = 48) {
    try {
        const config = await loadMapsConfig();
        if (!config || !config.maps) return null;

        let mapData = config.maps[mapName];
        if (!mapData) {
            mapData = Object.values(config.maps).find(m => m.faceitName === mapName);
        }

        const cdnUrl = await getCdnUrl();
        if (mapData && mapData.icon) {
            return `${cdnUrl}/web/images/maps/${size}/${mapData.icon}`;
        }

        const mapId = mapData ? null : mapName;
        if (mapId) {
            return `${cdnUrl}/web/images/maps/${size}/map_icon_${mapId}.png`;
        }

        return null;
    } catch {
        return null;
    }
}

function formatMapName(mapName) {
    return mapName.replace("de_", "").replace(/(\d)/g, " $1").toUpperCase();
}

function getKillsColorClass(avgKills) {
    const k = parseFloat(avgKills);
    if (isNaN(k)) return '';
    if (k < 14) return 'fc-stat-red';
    if (k <= 17) return 'fc-stat-yellow';
    return 'fc-stat-green';
}

function formatGamesWR(totalGames, wins) {
    const wr = Math.round(wins / totalGames * 100);
    return {wr, games: totalGames};
}

async function setupPlayerCardMatchData(playerId, targetNode, matchAmount, mode) {
    let tableId = `session-${matchRoomModule.sessionId}-player-table-${playerId}`
    if (targetNode.querySelector(`[class~=${tableId}]`)) return null
    let template = mode === 'classic' ? CLASSIC_PLAYER_WINRATE_TABLE_TEMPLATE
        : mode === 'radar' ? RADAR_PLAYER_STATS_TABLE_TEMPLATE
            : PLAYER_WINRATE_TABLE_TEMPLATE;
    let htmlResource = template.cloneNode(true);
    localizeHtmlResource(htmlResource);
    const statsTextEl = htmlResource.querySelector('.fc-panel-stats-text');
    if (statsTextEl) {
        const lastNKey = mode === 'radar' ? 'radar_n_matches' : 'last_n_matches';
        statsTextEl.textContent = t(lastNKey, `Last ${matchAmount} matches`).replace('{0}', matchAmount);
    }
    setupBrandIcon(htmlResource, 24, 24)
    appendTo(htmlResource, targetNode)
    let container = htmlResource.querySelector(".fc-player-panel")
    if (container) container.classList.add(tableId)
    return htmlResource
}

function calculateTeamMatches(teamMap) {
    const teamMatches = {};

    teamMap.forEach(({maps}) => {
        maps.forEach((data, mapName) => {
            if (!teamMatches[mapName]) teamMatches[mapName] = {wins: 0, totalGames: 0, totalKills: 0, totalDeaths: 0};
            teamMatches[mapName].wins += data.wins;
            teamMatches[mapName].totalGames += data.totalGames;
            teamMatches[mapName].totalKills += data.totalKills;
            teamMatches[mapName].totalDeaths += data.totalDeaths;
        });
    });

    return teamMatches;
}

function computeOverallAverages(matchesObj) {
    let totalWins = 0, totalGames = 0, totalKills = 0, totalDeaths = 0;
    Object.values(matchesObj).forEach(data => {
        totalWins += data.wins;
        totalGames += data.totalGames;
        totalKills += data.totalKills;
        totalDeaths += data.totalDeaths;
    });
    if (totalGames === 0) return {wr: 0, avgKills: '0.0', avgKD: '0.00', totalGames: 0, totalWins: 0};
    return {
        wr: Math.round(totalWins / totalGames * 100),
        avgKills: (totalKills / totalGames).toFixed(1),
        avgKD: totalDeaths > 0 ? (totalKills / totalDeaths).toFixed(2) : '0.00',
        totalGames,
        totalWins
    };
}

async function displayTeamStats(htmlResource, team1Matches, team2Matches) {
    const avg1 = computeOverallAverages(team1Matches);
    const avg2 = computeOverallAverages(team2Matches);

    htmlResource.querySelector('.fc-team1-overall-kills').textContent = avg1.avgKills;
    htmlResource.querySelector('.fc-team2-overall-kills').textContent = avg2.avgKills;

    const allMaps = new Set([...Object.keys(team1Matches), ...Object.keys(team2Matches)]);
    const tbody = htmlResource.querySelector('.fc-team-table-body');
    const mapsArray = [...allMaps].sort();
    const iconUrls = await Promise.all(mapsArray.map(m => getMapIconUrl(m)));
    const icons = new Map(mapsArray.map((m, i) => [m, iconUrls[i]]));

    for (const mapName of mapsArray) {
        const d1 = team1Matches[mapName];
        const d2 = team2Matches[mapName];
        const iconUrl = icons.get(mapName);
        const displayName = formatMapName(mapName);

        const row = tbody.insertRow();

        const wr1 = d1 ? Math.round(d1.wins / d1.totalGames * 100) : null;
        const wr2 = d2 ? Math.round(d2.wins / d2.totalGames * 100) : null;

        const mapCell = row.insertCell(0);
        const imgHtml = iconUrl ? `<img src="${iconUrl}" alt="${displayName}">` : '';
        mapCell.innerHTML = `<div class="fc-table-map">${imgHtml}<span>${displayName}</span></div>`;

        if (d1) {
            const {games: g1} = formatGamesWR(d1.totalGames, d1.wins);
            const avgK1 = (d1.totalKills / d1.totalGames).toFixed(1);

            const wrCell = row.insertCell(1);
            const wrClass = wr2 === null ? 'fc-wr-tie' : wr1 > wr2 ? 'fc-wr-win' : wr1 < wr2 ? 'fc-wr-lose' : 'fc-wr-tie';
            wrCell.innerHTML = `<span class="fc-val ${wrClass}">${wr1}%</span>`;
            row.insertCell(2).innerHTML = `<span class="fc-val">${g1}</span>`;
            row.insertCell(3).innerHTML = `<span class="fc-val ${getKillsColorClass(avgK1)}">${avgK1}</span>`;
        } else {
            row.insertCell(1).innerHTML = `<span class="fc-val fc-val-dim">—</span>`;
            row.insertCell(2).innerHTML = `<span class="fc-val fc-val-dim">—</span>`;
            row.insertCell(3).innerHTML = `<span class="fc-val fc-val-dim">—</span>`;
        }

        if (d2) {
            const {games: g2} = formatGamesWR(d2.totalGames, d2.wins);
            const avgK2 = (d2.totalKills / d2.totalGames).toFixed(1);

            const wrCell = row.insertCell(4);
            wrCell.classList.add('fc-sep-t2');
            const wrClass = wr1 === null ? 'fc-wr-tie' : wr2 > wr1 ? 'fc-wr-win' : wr2 < wr1 ? 'fc-wr-lose' : 'fc-wr-tie';
            wrCell.innerHTML = `<span class="fc-val ${wrClass}">${wr2}%</span>`;
            row.insertCell(5).innerHTML = `<span class="fc-val">${g2}</span>`;
            row.insertCell(6).innerHTML = `<span class="fc-val ${getKillsColorClass(avgK2)}">${avgK2}</span>`;
        } else {
            const emptyCell = row.insertCell(4);
            emptyCell.classList.add('fc-sep-t2');
            emptyCell.innerHTML = `<span class="fc-val fc-val-dim">—</span>`;
            row.insertCell(5).innerHTML = `<span class="fc-val fc-val-dim">—</span>`;
            row.insertCell(6).innerHTML = `<span class="fc-val fc-val-dim">—</span>`;
        }
    }
}

async function displayPlayerStats(htmlResource, playerMaps) {
    const overall = computeOverallAverages(
        Object.fromEntries(Array.from(playerMaps.entries()).map(([k, v]) => [k, v]))
    );

    const killsEl = htmlResource.querySelector('.fc-overall-kills');
    if (killsEl) killsEl.textContent = overall.avgKills;
    const kdEl = htmlResource.querySelector('.fc-overall-kd');
    if (kdEl) kdEl.textContent = overall.avgKD;

    const tbody = htmlResource.querySelector('.fc-ptable tbody');

    const sorted = Array.from(playerMaps.entries())
        .sort(([, a], [, b]) => (b.wins / b.totalGames) - (a.wins / a.totalGames));

    for (const [mapName, data] of sorted) {
        const iconUrl = await getMapIconUrl(mapName);
        const displayName = formatMapName(mapName);
        const {wr, games} = formatGamesWR(data.totalGames, data.wins);
        const avgK = (data.totalKills / data.totalGames).toFixed(1);

        const row = tbody.insertRow();
        const mapCell = row.insertCell(0);
        const imgHtml = iconUrl ? `<img src="${iconUrl}" alt="${displayName}">` : '';
        mapCell.innerHTML = `<div class="fc-ptable-map">${imgHtml}<span>${displayName}</span></div>`;

        const wrCell = row.insertCell(1);
        wrCell.innerHTML = `<span class="fc-val">${wr}%</span>`;
        setGradientColor(wrCell.querySelector('.fc-val'), wr);

        row.insertCell(2).innerHTML = `<span class="fc-val">${games}</span>`;
        row.insertCell(3).innerHTML = `<span class="fc-val ${getKillsColorClass(avgK)}">${avgK}</span>`;
    }
}

async function displayClassicPlayerStats(htmlResource, playerMaps) {
    const tbody = htmlResource.querySelector('.fc-classic-table tbody');

    const sorted = Array.from(playerMaps.entries())
        .sort(([, a], [, b]) => (b.wins / b.totalGames) - (a.wins / a.totalGames));

    for (const [mapName, data] of sorted) {
        const iconUrl = await getMapIconUrl(mapName);
        const displayName = formatMapName(mapName);
        const {wr, games} = formatGamesWR(data.totalGames, data.wins);

        const row = tbody.insertRow();
        const mapCell = row.insertCell(0);
        const imgHtml = iconUrl ? `<img src="${iconUrl}" alt="${displayName}" style="width:18px;height:18px;border-radius:2px;object-fit:cover;vertical-align:middle;margin-right:4px">` : '';
        mapCell.innerHTML = `${imgHtml}<span style="font-size:10px;color:#bbb;text-transform:uppercase">${displayName}</span>`;

        row.insertCell(1).textContent = games;

        const wrCell = row.insertCell(2);
        wrCell.textContent = wr + '%';
        setGradientColor(wrCell, wr);
    }
}

async function displayClassicTeamStats(htmlResource, team1Matches, team2Matches) {
    const roster1Tbody = htmlResource.querySelector('.roster1 tbody');
    const roster2Tbody = htmlResource.querySelector('.roster2 tbody');

    const addClassicRow = async (tbody, mapName, data) => {
        const iconUrl = await getMapIconUrl(mapName);
        const displayName = formatMapName(mapName);
        const wr = Math.round(data.wins / data.totalGames * 100);

        const row = tbody.insertRow();
        const mapCell = row.insertCell(0);
        const imgHtml = iconUrl ? `<img src="${iconUrl}" alt="${displayName}" style="width:18px;height:18px;border-radius:2px;object-fit:cover;vertical-align:middle;margin-right:4px">` : '';
        mapCell.innerHTML = `${imgHtml}<span style="font-size:10px;color:#bbb;text-transform:uppercase">${displayName}</span>`;

        row.insertCell(1).textContent = data.totalGames;

        const wrCell = row.insertCell(2);
        wrCell.textContent = wr + '%';
        setGradientColor(wrCell, wr);
    };

    const sorted1 = Object.entries(team1Matches)
        .sort(([, a], [, b]) => (b.wins / b.totalGames) - (a.wins / a.totalGames));
    for (const [mapName, data] of sorted1) {
        await addClassicRow(roster1Tbody, mapName, data);
    }

    const sorted2 = Object.entries(team2Matches)
        .sort(([, a], [, b]) => (b.wins / b.totalGames) - (a.wins / a.totalGames));
    for (const [mapName, data] of sorted2) {
        await addClassicRow(roster2Tbody, mapName, data);
    }
}

async function getMatchWinRates(matchId) {
    if (!matchId) {
        error("Match ID is not provided!");
        return
    }

    const matchStats = await fetchMatchStats(matchId);
    if (!matchStats || !matchStats.teams) {
        error("Error when retrieving match statistics: Incorrect match structure.");
        return
    }

    const settings = await getSettings({
        teamMapWinrate: true,
        playerMapWinrate: true,
        showTeamElo: true,
        eloranking: true,
        sliderValue: 30
    });

    const vm = await CLIENT_STORAGE_SYNC.get(['teamViewMode', 'classicTeamView', 'playerViewMode', 'classicPlayerView']);
    settings.teamViewMode = vm.teamViewMode ?? (vm.classicTeamView ? 'classic' : 'radar');
    settings.playerViewMode = vm.playerViewMode ?? (vm.classicPlayerView ? 'classic' : 'radar');

    injectRosterLevels(matchStats, settings);
    displayWinRates(matchStats, settings);
}

function injectRosterLevels(matchDetails, settings) {
    if (!matchDetails || !matchDetails.teams || !settings.showTeamElo) return;
    const cls = `fc-roster-rank-${matchRoomModule.sessionId}`;
    matchRoomModule.doAfterAllNodeAppear(sel('matchroom.headerFaction'), (node) => {
        if (node.querySelector(`.${cls}`)) return;
        const siblings = Array.from(node.parentElement.querySelectorAll(`:scope > ${sel('matchroom.headerFactionItem')}`));
        const idx = siblings.indexOf(node);
        if (idx < 0) return;
        const faction = idx === 0 ? matchDetails.teams.faction1 : matchDetails.teams.faction2;
        const elo = Number.parseInt(faction && faction.stats && faction.stats.rating, 10);
        if (!elo || isNaN(elo)) return;
        let level = getLevel(elo, 'cs2');
        if (level < 1) return;
        if (!settings.eloranking) level = Math.min(level, 10);
        const iconWrapper = getLevelIcon(level, 38, 38);
        if (!iconWrapper) return;

        const box = document.createElement('div');
        box.className = `${cls} fc-roster-rank`;
        if (idx !== 0) box.classList.add('fc-roster-rank-right');
        const iconNode = iconWrapper.firstChild;
        iconNode.classList.add('fc-roster-ico');
        box.appendChild(iconNode);
        const eloSpan = document.createElement('span');
        eloSpan.className = 'fc-roster-elo';
        eloSpan.textContent = elo;
        box.appendChild(eloSpan);
        node.prepend(box);
        matchRoomModule.removalNode(box);
    });
}

async function findUserCard(playerId, nickname, rosterNicks, callback) {
    const nickNodeSelector = sel('matchroom.nickNode');

    const claim = (node) => {
        const parentNode = getNthParent(node, idx('matchroom.nickNodeParentDepth', 4))
        matchRoomModule.doAfter(() => parentNode.querySelector(sel('matchroom.ratingsContainer')), (ratingsNode) => {
            if (!matchRoomModule.isProcessedNode(ratingsNode)) {
                matchRoomModule.processedNode(ratingsNode);
                callback(ratingsNode);
            }
        }, 50)
    };

    matchRoomModule.doAfterNodeAppearWithCondition(nickNodeSelector, () => true, async (node) => {
        const popupNick = node.innerText;

        if (popupNick === nickname) {
            claim(node);
            return;
        }

        if (rosterNicks && rosterNicks.has(popupNick)) return;

        const data = await fetchPlayerStatsByNickName(popupNick);
        if (data && data.player_id === playerId) {
            claim(node);
        }
    }, `${nickNodeSelector}-${playerId}`)
}

async function calculateStats(team, playerId, nickname, rosterNicks, matchAmount, settings, to = 0, playerRadarCtx = null) {
    let gameType = extractGameType("cs2")
    let data = await fetchPlayerInGameStats(playerId, gameType, matchAmount, to);

    if (!data.items || data.items.length === 0) {
        return;
    }

    if (!matchRoomModule.teamCache.has(team)) matchRoomModule.teamCache.set(team, new Map());

    const teamMap = matchRoomModule.teamCache.get(team);

    data.items.forEach(item => {
        const stats = item.stats;
        if (stats["Game Mode"] !== "5v5") return;

        const mapName = stats["Map"];
        const result = Number.parseInt(stats["Result"]);
        const kills = Number.parseInt(stats["Kills"]) || 0;
        const deaths = Number.parseInt(stats["Deaths"]) || 0;

        if (!teamMap.has(playerId)) {
            teamMap.set(playerId, {nickname: stats["Nickname"], maps: new Map()});
        }

        const playerData = teamMap.get(playerId).maps;

        if (!playerData.has(mapName)) {
            playerData.set(mapName, {wins: 0, totalGames: 0, totalKills: 0, totalDeaths: 0});
        }

        const mapData = playerData.get(mapName);
        mapData.wins += result;
        mapData.totalGames += 1;
        mapData.totalKills += kills;
        mapData.totalDeaths += deaths;
    });

    if (settings.playerMapWinrate) {
        const playerMode = settings.playerViewMode || 'radar';
        const radarMode = playerMode === 'radar' && playerRadarCtx;
        await findUserCard(playerId, nickname, rosterNicks, async userCardElement => {
            let htmlResource = await setupPlayerCardMatchData(playerId, userCardElement, matchAmount, radarMode ? 'radar' : playerMode)
            if (!htmlResource) return;

            const playerStats = teamMap.get(playerId);
            if (!playerStats) return;

            if (radarMode) {
                const thisRoster = team.split('$').pop();
                const isYou = playerRadarCtx.viewerRoster ? (thisRoster === playerRadarCtx.viewerRoster) : (thisRoster === 'roster1');
                const align = thisRoster === 'roster2' ? 'right' : 'left';
                await displayPlayerRadar(htmlResource, playerStats.maps, isYou, playerStats.nickname || nickname, align);
            } else if (playerMode === 'classic') {
                await displayClassicPlayerStats(htmlResource, playerStats.maps);
            } else {
                await displayPlayerStats(htmlResource, playerStats.maps);
            }
        });
    }
}

async function displayWinRates(matchDetails, settings) {
    const team1 = matchDetails["teams"]["faction1"];
    const team2 = matchDetails["teams"]["faction2"];

    const rosterNicks = new Set();
    for (const p of [...(team1["roster"] || []), ...(team2["roster"] || [])]) {
        if (p && p["nickname"]) rosterNicks.add(p["nickname"]);
    }

    const matchAmount = settings.sliderValue;
    const matchTo = getMatchTimestamp(matchDetails);
    const teamMode = settings.teamViewMode || 'radar';

    let playerRadarCtx = null;
    if (settings.playerMapWinrate && (settings.playerViewMode || 'radar') === 'radar') {
        const vid = await getViewerPlayerId();
        const viewerRoster = vid ? (rosterHasPlayer(team1, vid) ? 'roster1' : rosterHasPlayer(team2, vid) ? 'roster2' : null) : null;
        playerRadarCtx = {viewerRoster};
    }

    const matchId = extractMatchId();
    const cached = settings.teamMapWinrate ? await fcReadTeamCache(matchId, matchAmount) : null;

    let teamCtl = null;
    const pushTeam = () => {
        if (!teamCtl) return;
        const {team1Matches, team2Matches} = aggregateTeamMatches();
        teamCtl.update(team1Matches, team2Matches);
    };

    if (settings.teamMapWinrate) {
        setupTeamPanel(matchDetails, settings, team1, team2, teamMode).then(ctl => {
            teamCtl = ctl;
            if (cached) teamCtl.update(cached.t1, cached.t2);
            else pushTeam();
        });
    }

    const tap = p => (settings.teamMapWinrate && !cached) ? p.then(r => (pushTeam(), r)) : p;

    const team1Promises = team1["roster"].map(player =>
        tap(calculateStats(`${team1.name}$roster1`, player["player_id"], player["nickname"], rosterNicks, matchAmount, settings, matchTo, playerRadarCtx))
    );
    const team2Promises = team2["roster"].map(player =>
        tap(calculateStats(`${team2.name}$roster2`, player["player_id"], player["nickname"], rosterNicks, matchAmount, settings, matchTo, playerRadarCtx))
    );

    await Promise.all([...team1Promises, ...team2Promises]);
    pushTeam();

    if (settings.teamMapWinrate) {
        const {team1Matches, team2Matches} = aggregateTeamMatches();
        if (Object.keys(team1Matches).length || Object.keys(team2Matches).length) {
            fcWriteTeamCache(matchId, matchAmount, team1Matches, team2Matches);
        }
    }
}

const FC_MR_CACHE_TTL_MIN = 30;

function fcReadTeamCache(matchId, matchAmount) {
    if (!matchId) return Promise.resolve(null);
    return getApiCache(`fc-mrcache-${matchId}-${matchAmount}`).then(c => (c && c.t1 && c.t2) ? c : null);
}

function fcWriteTeamCache(matchId, matchAmount, t1, t2) {
    if (!matchId) return;
    setApiCache(`fc-mrcache-${matchId}-${matchAmount}`, {t1, t2}, FC_MR_CACHE_TTL_MIN);
}

function getMatchTimestamp(matchDetails) {
    const ts = (matchDetails && (matchDetails.started_at || matchDetails.configured_at || matchDetails.finished_at)) || 0;
    if (!ts) return 0;
    return ts < 1e12 ? ts * 1000 : ts;
}

function aggregateTeamMatches() {
    let team1Matches = {}, team2Matches = {};
    matchRoomModule.teamCache.forEach((teamMap, teamNameRaw) => {
        const roster = teamNameRaw.split("$").pop();
        const matches = calculateTeamMatches(teamMap);
        if (roster === 'roster1') team1Matches = matches; else team2Matches = matches;
    });
    return {team1Matches, team2Matches};
}

const FC_RADAR_METRIC_KEY = 'mapRadarMetric';

function extractMapPool(matchDetails) {
    const ents = matchDetails && matchDetails.voting && matchDetails.voting.map && matchDetails.voting.map.entities;
    if (Array.isArray(ents) && ents.length) {
        const ids = ents.map(e => e && (e.game_map_id || e.guid || e.class_name || e.name)).filter(Boolean);
        if (ids.length) return ids;
    }
    return null;
}

const FC_GUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
let _fcSelfIdCache;

async function fetchFaceitSelfId() {
    if (_fcSelfIdCache !== undefined) return _fcSelfIdCache;
    _fcSelfIdCache = null;
    try {
        const res = await fetch('https://www.faceit.com/api/users/v1/sessions/me', {credentials: 'include'});
        if (res.ok) {
            const data = await res.json();
            const id = data && data.payload && data.payload.id;
            if (id && FC_GUID_RE.test(String(id))) _fcSelfIdCache = String(id);
        }
    } catch (_) {}
    return _fcSelfIdCache;
}

async function getViewerPlayerId() {
    return await fetchFaceitSelfId();
}


function rosterHasPlayer(team, playerId) {
    const roster = team && team.roster;
    return Array.isArray(roster) && roster.some(p => p && p.player_id === playerId);
}

function fcRadarEsc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
}

const fcClamp01 = v => Math.max(0, Math.min(1, v));

function fcRadarPolar(cx, cy, R, frac, deg) {
    const a = (deg - 90) * Math.PI / 180;
    return [cx + R * frac * Math.cos(a), cy + R * frac * Math.sin(a)];
}

async function getRadarAxisIds(matchDetails) {
    const pool = extractMapPool(matchDetails);
    if (pool && pool.length) {
        const ids = pool.filter(id => /^de_/.test(String(id)));
        if (ids.length) return ids;
    }
    try {
        const cfg = await loadMapsConfig();
        if (cfg && cfg.maps) {
            const ids = Object.keys(cfg.maps).filter(id => cfg.maps[id] && cfg.maps[id].active);
            if (ids.length) return ids;
        }
    } catch (_) {}
    return [];
}

function fcMapStat(matches, id) {
    const d = matches && matches[id];
    if (!d || !d.totalGames) return {wr: null, avg: null, games: 0};
    return {
        wr: Math.round(d.wins / d.totalGames * 100),
        avg: +(d.totalKills / d.totalGames).toFixed(1),
        games: d.totalGames
    };
}

function fcRadarComputeAxes(axisDefs, matchesA, matchesB) {
    return axisDefs.map(d => {
        const a = fcMapStat(matchesA, d.id), b = fcMapStat(matchesB, d.id);
        return {id: d.id, name: d.name, icon: d.icon, wrA: a.wr, wrB: b.wr, avgA: a.avg, avgB: b.avg, gA: a.games, gB: b.games};
    });
}

function fcRadarMetricParams(axes, m) {
    if (m === 'avg') {
        const a = axes.flatMap(x => [x.avgA, x.avgB]).filter(v => v != null);
        if (!a.length) return {key: 'avg', min: 0, max: 1, unit: ''};
        const lo = Math.floor((Math.min(...a) - 1) / 5) * 5;
        const hi = Math.ceil((Math.max(...a) + 1) / 5) * 5;
        return {key: 'avg', min: lo, max: Math.max(hi, lo + 5), unit: ''};
    }
    return {key: 'wr', min: 0, max: 100, unit: '%'};
}

function fcRadarAxisFrac(ax, side, p) {
    const v = ax[p.key + side];
    return v == null ? 0 : fcClamp01((v - p.min) / (p.max - p.min));
}

function fcRadarAxisVal(ax, side, p) {
    const v = ax[p.key + side];
    return v == null ? '—' : (p.unit === '%' ? v + '%' : v);
}

function fcWrColor(p) {
    const v = Math.min(Math.max(parseFloat(p) || 0, 0), 100), r = v / 100;
    return r < 0.5 ? interpolateColor('#ff0022', '#fbec1e', r * 2) : interpolateColor('#fbec1e', '#32d35a', (r - 0.5) * 2);
}

function fcKillsColor(k) {
    const v = parseFloat(k);
    if (isNaN(v)) return '#888888';
    if (v < 14) return 'rgb(255,0,43)';
    if (v <= 17) return 'rgb(255,200,0)';
    return 'rgb(61,255,108)';
}

const FC_RAD_GREEN = '#2fbf71', FC_RAD_RED = '#e5484d';
const FC_RAD_GREEN_FILL = 'rgba(47,191,113,0.22)', FC_RAD_RED_FILL = 'rgba(229,72,77,0.16)';

function setupTeamPanel(matchDetails, settings, team1, team2, teamMode) {
    return new Promise(resolve => {
        const matchAmount = settings.sliderValue;
        const teamTableNodeId = `team-table-${matchRoomModule.sessionId}`;
        let resolved = false;
        matchRoomModule.doAfterAllNodeAppear(sel('matchroom.teamTable'), async (node) => {
            if (resolved) return;
            let existing = node.querySelector(`[class*=fc-team-panel]`);
            if (existing) {
                if (existing.classList.contains(teamTableNodeId)) return;
                else existing.remove();
            }
            const targetNode = node.matches(sel('matchroom.infoName')) ? node : node.querySelector(sel('matchroom.teamTable'));
            if (!targetNode) return;
            if (matchRoomModule.isProcessedNode(targetNode)) return;

            const innerNode = targetNode.querySelector('[class*=forecast-banner]') ?? targetNode.querySelector(sel('matchroom.overviewStack'));
            if (!innerNode) return;
            matchRoomModule.processedNode(targetNode);
            const template = teamMode === 'classic' ? CLASSIC_TEAM_WINRATE_TABLE_TEMPLATE
                : teamMode === 'radar' ? RADAR_TEAM_STATS_TABLE_TEMPLATE
                    : TEAM_WINRATE_TABLE_TEMPLATE;
            const htmlResource = template.cloneNode(true);
            localizeHtmlResource(htmlResource);
            setupBrandIcon(htmlResource, 24, 24);
            const statsTextEl = htmlResource.querySelector('.fc-panel-stats-text');
            if (statsTextEl) {
                const lastNKey = teamMode === 'radar' ? 'radar_last_n_matches' : 'stats_last_n_matches';
                statsTextEl.textContent = t(lastNKey, `Stats for last ${matchAmount} matches`).replace('{0}', matchAmount);
            }
            node.style.overflowBlock = 'unset';
            htmlResource.classList.add(teamTableNodeId);
            innerNode.after(htmlResource);
            htmlResource.querySelectorAll('.roster1-name').forEach(el => el.textContent = team1.name);
            htmlResource.querySelectorAll('.roster2-name').forEach(el => el.textContent = team2.name);

            let ctl;
            if (teamMode === 'radar') {
                const [axisIds, viewerId] = await Promise.all([getRadarAxisIds(matchDetails), getViewerPlayerId()]);
                const flip = viewerId ? (!rosterHasPlayer(team1, viewerId) && rosterHasPlayer(team2, viewerId)) : false;
                const youKnown = viewerId ? (rosterHasPlayer(team1, viewerId) || rosterHasPlayer(team2, viewerId)) : false;
                ctl = await initTeamRadar(htmlResource, axisIds, team1.name, team2.name, flip, youKnown);
            } else {
                const poolSet = new Set(await getRadarAxisIds(matchDetails));
                const renderFn = teamMode === 'classic' ? renderClassicTable : renderAdvancedTable;
                ctl = fcTableController(htmlResource, (h, t1, t2) => renderFn(h, fcFilterToPool(t1, poolSet), fcFilterToPool(t2, poolSet)));
            }
            resolved = true;
            resolve(ctl);
        });
    });
}

function fcTableController(htmlResource, renderFn) {
    let latest = null, busy = false;
    const pump = async () => {
        if (busy) return;
        busy = true;
        while (latest) {
            const d = latest; latest = null;
            try { await renderFn(htmlResource, d.t1, d.t2); } catch (_) {}
        }
        busy = false;
    };
    return {update(t1, t2) { latest = {t1, t2}; pump(); }};
}

function fcFilterToPool(matches, poolSet) {
    if (!poolSet || !poolSet.size) return matches;
    const out = {};
    for (const k of Object.keys(matches)) if (poolSet.has(k)) out[k] = matches[k];
    return out;
}

async function renderAdvancedTable(htmlResource, t1, t2) {
    const tbody = htmlResource.querySelector('.fc-team-table-body');
    if (tbody) tbody.replaceChildren();
    await displayTeamStats(htmlResource, t1, t2);
}

async function renderClassicTable(htmlResource, t1, t2) {
    htmlResource.querySelectorAll('.fc-classic-table tbody').forEach(tb => tb.replaceChildren());
    await displayClassicTeamStats(htmlResource, t1, t2);
}

async function fcReadRadarMetric() {
    try {
        const stored = await CLIENT_STORAGE_SYNC.get([FC_RADAR_METRIC_KEY]);
        const v = stored && stored[FC_RADAR_METRIC_KEY];
        if (v === 'avg' || v === 'wr') return v;
    } catch (_) {}
    return 'wr';
}

function fcWireSeg(htmlResource, metric, onChange) {
    const segBtns = htmlResource.querySelectorAll('.fc-seg-btn');
    let cur = metric;
    const setActive = m => segBtns.forEach(b => b.classList.toggle('fc-seg-on', b.dataset.m === m));
    setActive(cur);
    segBtns.forEach(b => b.addEventListener('click', async () => {
        if (b.dataset.m === cur) return;
        cur = b.dataset.m;
        try { await CLIENT_STORAGE_SYNC.set({[FC_RADAR_METRIC_KEY]: cur}); } catch (_) {}
        setActive(cur);
        onChange(cur);
    }));
}

async function initTeamRadar(htmlResource, axisIds, team1Name, team2Name, flip, youKnown) {
    const body = htmlResource.querySelector('.fc-radar-body');
    if (!body) return {update() {}};

    const metric = await fcReadRadarMetric();
    const axisDefs = (axisIds || []).map(id => ({id, name: formatMapName(id), icon: null}));
    if (!axisDefs.length) {
        body.innerHTML = `<div class="fc-radar-empty">${t('radar_no_data', 'No data')}</div>`;
        return {update() {}};
    }

    const greenName = flip ? team2Name : team1Name;
    const redName = flip ? team1Name : team2Name;
    const align = youKnown ? (flip ? 'right' : 'left') : 'center';

    let chart;
    if (axisDefs.length >= 3) {
        const sides = [
            {stroke: FC_RAD_GREEN, fill: FC_RAD_GREEN_FILL, label: greenName, you: youKnown},
            {stroke: FC_RAD_RED, fill: FC_RAD_RED_FILL, label: redName, you: false}
        ];
        chart = fcRadarChartController(body, axisDefs, sides, metric, align);
    } else {
        const iconUrls = await Promise.all(axisDefs.map(d => getMapIconUrl(d.id, 128)));
        axisDefs.forEach((d, i) => d.icon = iconUrls[i]);
        chart = fcRadarBarsController(body, axisDefs, {a: greenName, b: redName, you: youKnown}, metric, align);
    }

    fcWireSeg(htmlResource, metric, m => chart.setMetric(m));

    return {update(t1, t2) { chart.update(flip ? t2 : t1, flip ? t1 : t2); }};
}

async function displayPlayerRadar(htmlResource, playerMaps, isYou, label, align) {
    const body = htmlResource.querySelector('.fc-radar-body');
    if (!body) return;

    const matchesObj = playerMaps instanceof Map ? Object.fromEntries(playerMaps) : (playerMaps || {});
    const ids = Object.keys(matchesObj).filter(k => matchesObj[k] && matchesObj[k].totalGames).sort();
    if (!ids.length) {
        body.innerHTML = `<div class="fc-radar-empty">${t('radar_no_data', 'No data')}</div>`;
        return;
    }

    if (ids.length >= 3) {
        const axisDefs = ids.map(id => ({id, name: formatMapName(id), icon: null}));
        const metric = await fcReadRadarMetric();
        const chart = fcRadarChartController(body, axisDefs, [{stroke: '#ff7300', fill: 'rgba(255,115,0,0.20)', label, you: false}], metric, align, {noLegend: true, noStagger: true, valColorByMetric: true, overallStats: true});
        fcWireSeg(htmlResource, metric, m => chart.setMetric(m));
        chart.update(matchesObj);
        return;
    }

    const seg = htmlResource.querySelector('.fc-seg');
    if (seg) seg.style.display = 'none';
    const iconUrls = await Promise.all(ids.map(id => getMapIconUrl(id, 128)));
    const ov = computeOverallAverages(matchesObj);
    const top = `<div class="fc-pmaps-top">`
        + `<div class="fc-pmaps-ov"><div class="fc-rad-corner-lbl">${t('radar_wr_full', 'WINRATE')}</div><div class="fc-rad-corner-big" style="color:${fcWrColor(ov.wr)}">${ov.wr}%</div></div>`
        + `<div class="fc-pmaps-ov fc-pmaps-ov-r"><div class="fc-rad-corner-lbl">${t('radar_avg_full', 'AVG KILLS')}</div><div class="fc-rad-corner-big" style="color:${fcKillsColor(ov.avgKills)}">${ov.avgKills}</div></div>`
        + `</div>`;
    const card = (id, i) => {
        const st = fcMapStat(matchesObj, id);
        const img = iconUrls[i] ? `<img src="${iconUrls[i]}" alt="">` : '';
        const wrC = st.wr != null ? fcWrColor(st.wr) : '#555';
        const avgC = st.avg != null ? fcKillsColor(st.avg) : '#555';
        return `<div class="fc-phero-card">
            <div class="fc-phero-hd">${img}<span>${fcRadarEsc(formatMapName(id))}</span></div>
            <div class="fc-phero-stat-line"><span class="fc-phero-val" style="color:${wrC}">${st.wr != null ? st.wr + '%' : '—'}</span><span class="fc-phero-statlbl">${t('radar_wr_full', 'WINRATE')}</span></div>
            <div class="fc-phero-stat-line"><span class="fc-phero-val" style="color:${avgC}">${st.avg != null ? st.avg : '—'}</span><span class="fc-phero-statlbl">${t('radar_avg_full', 'AVG KILLS')}</span></div>
            <div class="fc-phero-games">${st.games} ${t('radar_games', 'games')}</div>
        </div>`;
    };
    body.innerHTML = top + `<div class="fc-phero ${ids.length === 1 ? 'fc-phero-1' : 'fc-phero-2'}">` + ids.map((id, i) => card(id, i)).join('') + `</div>`;
}

function fcRadarChartController(body, axisDefs, sides, metric, align, opts) {
    opts = opts || {};
    const single = sides.length === 1;
    const SIZE = single ? 344 : 350, CX = SIZE / 2, CY = SIZE / 2, R = single ? 98 : 92, N = axisDefs.length, step = 360 / N, RINGS = 4, LO = single ? 36 : 38;
    const NAMEF = single ? '12.5' : '9.5', VALF = single ? '14.5' : '10', VALY = single ? 21 : 16;
    const dotR = single ? 3 : 2.3;
    const BASE = 0.07, TOP = 0.92;
    const NS = 'http://www.w3.org/2000/svg';
    const KEYS = ['A', 'B'];
    const SEP = '#6a6a72';
    const order = (align === 'right' && sides.length > 1) ? [1, 0] : sides.map((_, i) => i);
    const justify = align === 'left' ? 'flex-start' : align === 'right' ? 'flex-end' : 'center';

    let s = `<div class="fc-radar-wrap fc-rad-building"><svg class="fc-radar-svg" viewBox="0 0 ${SIZE} ${SIZE}">`;
    for (let g = 1; g <= RINGS; g++) {
        const f = g / RINGS, pts = [];
        for (let i = 0; i < N; i++) { const [x, y] = fcRadarPolar(CX, CY, R, f, i * step); pts.push(`${x.toFixed(1)},${y.toFixed(1)}`); }
        s += `<polygon points="${pts.join(' ')}" fill="none" stroke="#1f1f24" stroke-width="1"/>`;
    }
    for (let i = 0; i < N; i++) {
        const [x, y] = fcRadarPolar(CX, CY, R, 1, i * step);
        s += `<line x1="${CX}" y1="${CY}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="#1b1b20" stroke-width="1"/>`;
        const [cx2, cy2] = fcRadarPolar(CX, CY, R + LO, 1, i * step);
        s += `<image class="fc-rad-ico" x="${(cx2 - 14).toFixed(1)}" y="${(cy2 - 36).toFixed(1)}" width="28" height="28" style="opacity:0"/>`;
    }
    s += `<g class="fc-rad-dyn">`;
    for (let si = sides.length - 1; si >= 0; si--) s += `<polygon class="fc-rad-p${si}" points="" fill="${sides[si].fill}" stroke="${sides[si].stroke}" stroke-width="1.8" stroke-linejoin="round"/>`;
    for (let si = sides.length - 1; si >= 0; si--) for (let i = 0; i < N; i++) s += `<circle class="fc-rad-d${si}" cx="${CX}" cy="${CY}" r="${dotR}" style="opacity:0" fill="${sides[si].stroke}"/>`;
    s += `</g>`;
    for (let i = 0; i < N; i++) { const [cx2, cy2] = fcRadarPolar(CX, CY, R + LO, 1, i * step); s += `<text class="fc-rad-ng" x="${cx2.toFixed(1)}" y="${(cy2 + 4).toFixed(1)}" text-anchor="middle" font-weight="700" paint-order="stroke" stroke="#0c0c0e" stroke-width="2.2"></text>`; }
    for (let i = 0; i < N; i++) { const [cx2, cy2] = fcRadarPolar(CX, CY, R + LO, 1, i * step); s += `<text class="fc-rad-vals" x="${cx2.toFixed(1)}" y="${(cy2 + VALY).toFixed(1)}" text-anchor="middle" font-size="${VALF}" font-weight="800" paint-order="stroke" stroke="#0c0c0e" stroke-width="2.6"></text>`; }
    s += `</svg>`;
    const corners = (!opts.noLegend && sides.length === 2) || opts.overallStats;
    if (corners) {
        s += `<div class="fc-rad-corner fc-rad-corner-l"></div><div class="fc-rad-corner fc-rad-corner-r"></div>`;
    } else if (!opts.noLegend) {
        s += `<div class="fc-radar-legend" style="justify-content:${justify}">`;
        order.forEach(si => { const sd = sides[si]; s += `<span class="fc-rl-item"><i style="background:${sd.stroke}"></i>${fcRadarEsc(sd.label)}${sd.you ? ` · ${fcRadarEsc(t('radar_you', 'you'))}` : ''}</span>`; });
        s += `</div>`;
    }
    s += `</div>`;
    body.innerHTML = s;

    const wrap = body.querySelector('.fc-radar-wrap');
    const svg = body.querySelector('.fc-radar-svg');
    const polys = sides.map((_, si) => svg.querySelector(`.fc-rad-p${si}`));
    const dots = sides.map((_, si) => Array.from(svg.querySelectorAll(`.fc-rad-d${si}`)));
    const ngEls = Array.from(svg.querySelectorAll('.fc-rad-ng'));
    const valEls = Array.from(svg.querySelectorAll('.fc-rad-vals'));
    const icoEls = Array.from(svg.querySelectorAll('.fc-rad-ico'));
    const cornerEls = corners ? [body.querySelector('.fc-rad-corner-l'), body.querySelector('.fc-rad-corner-r')] : null;

    axisDefs.forEach((d, i) => {
        getMapIconUrl(d.id, 128).then(url => { if (url && icoEls[i]) { icoEls[i].setAttribute('href', url); icoEls[i].style.opacity = '1'; } }).catch(() => {});
    });

    let cur = sides.map(() => axisDefs.map(() => 0));
    let raf = 0, curMetric = metric, data = sides.map(() => ({})), started = false, buildDone = false;

    const finishBuild = () => { if (!buildDone) { buildDone = true; wrap.classList.remove('fc-rad-building'); } };
    const ptsStr = arr => arr.map((f, i) => { const [x, y] = fcRadarPolar(CX, CY, R, f, i * step); return `${x.toFixed(1)},${y.toFixed(1)}`; }).join(' ');

    const paint = () => {
        sides.forEach((_, si) => {
            polys[si].setAttribute('points', ptsStr(cur[si]));
            cur[si].forEach((f, i) => { const [dx, dy] = fcRadarPolar(CX, CY, R, f, i * step); dots[si][i].setAttribute('cx', dx.toFixed(1)); dots[si][i].setAttribute('cy', dy.toFixed(1)); });
        });
    };

    const compute = () => {
        const axes = fcRadarComputeAxes(axisDefs, data[0] || {}, data[1] || {});
        const p = fcRadarMetricParams(axes, curMetric);
        let maxG = 0;
        axes.forEach(a => sides.forEach((_, si) => { const g = a['g' + KEYS[si]] || 0; if (g > maxG) maxG = g; }));
        const conf = (a, si) => curMetric !== 'wr' ? 1 : (maxG > 0 ? Math.sqrt((a['g' + KEYS[si]] || 0) / maxG) : 0);
        let targets = sides.map((_, si) => axes.map(a => fcRadarAxisFrac(a, KEYS[si], p) * conf(a, si)));
        let maxT = 0;
        targets.forEach(arr => arr.forEach(v => { if (v > maxT) maxT = v; }));
        const span = TOP - BASE;
        targets = targets.map(arr => arr.map(v => maxT > 0 ? BASE + (v / maxT) * span : BASE));
        return {axes, p, targets};
    };

    const valColor = (a, si, p) => {
        if (!opts.valColorByMetric) return sides[si].stroke;
        const raw = a[p.key + KEYS[si]];
        if (raw == null) return '#555';
        return p.key === 'wr' ? fcWrColor(raw) : fcKillsColor(raw);
    };
    const tspan = (el, text, fill, fs) => {
        const ts = document.createElementNS(NS, 'tspan');
        ts.setAttribute('fill', fill);
        if (fs) ts.setAttribute('font-size', fs);
        ts.textContent = text;
        el.appendChild(ts);
    };
    const clear = el => { while (el.firstChild) el.removeChild(el.firstChild); };
    const setText = (axes, p) => {
        axes.forEach((a, i) => {
            const ng = ngEls[i];
            clear(ng);
            if (sides.length > 1) {
                tspan(ng, String(a['g' + KEYS[order[0]]] || 0), sides[order[0]].stroke, '9');
                tspan(ng, ' | ', SEP, '8');
                tspan(ng, axisDefs[i].name, '#9a9aa2', NAMEF);
                tspan(ng, ' | ', SEP, '8');
                tspan(ng, String(a['g' + KEYS[order[1]]] || 0), sides[order[1]].stroke, '9');
            } else {
                tspan(ng, axisDefs[i].name, '#9a9aa2', NAMEF);
            }
            const el = valEls[i];
            clear(el);
            order.forEach((si, idx) => {
                if (idx > 0) tspan(el, ' | ', SEP, null);
                tspan(el, fcRadarAxisVal(a, KEYS[si], p), valColor(a, si, p), null);
            });
            if (single) { tspan(el, ' | ', SEP, '11'); tspan(el, String(a.gA || 0), '#9a9aa2', '13'); }
        });
    };
    const has = (axes, si, i) => axes[i]['wr' + KEYS[si]] != null;

    const setCorners = () => {
        if (!corners) return;
        if (single) {
            const ov = computeOverallAverages(data[0] || {});
            cornerEls[0].innerHTML = `<div class="fc-rad-corner-lbl">${t('radar_wr_full', 'WINRATE')}</div><div class="fc-rad-corner-big" style="color:${fcWrColor(ov.wr)}">${ov.wr}%</div>`;
            cornerEls[1].innerHTML = `<div class="fc-rad-corner-lbl">${t('radar_avg_full', 'AVG KILLS')}</div><div class="fc-rad-corner-big" style="color:${fcKillsColor(ov.avgKills)}">${ov.avgKills}</div>`;
            return;
        }
        [order[0], order[1]].forEach((si, idx) => {
            const el = cornerEls[idx];
            const ov = computeOverallAverages(data[si] || {});
            const sd = sides[si];
            const youTag = sd.you ? ` · ${fcRadarEsc(t('radar_you', 'you'))}` : '';
            const right = idx === 1;
            const stat = (lblKey, lbl, val) => right
                ? `<div class="fc-rad-corner-stat"><b style="color:${sd.stroke}">${val}</b> ${t(lblKey, lbl)}</div>`
                : `<div class="fc-rad-corner-stat">${t(lblKey, lbl)} <b style="color:${sd.stroke}">${val}</b></div>`;
            el.innerHTML = `<div class="fc-rad-corner-name"><i style="background:${sd.stroke}"></i><span>${fcRadarEsc(sd.label)}${youTag}</span></div>`
                + stat('radar_wr_full', 'WINRATE', ov.wr + '%')
                + stat('radar_avg_full', 'AVG KILLS', ov.avgKills);
        });
    };

    const reveal = (targets, axes) => {
        if (raf) cancelAnimationFrame(raf);
        const stagger = !opts.noStagger;
        const dur = stagger ? 900 : 0, vdur = stagger ? 240 : 520, total = dur + vdur, start = performance.now();
        const ease = x => 1 - Math.pow(1 - x, 3);
        const frame = now => {
            const el = now - start;
            for (let i = 0; i < N; i++) {
                const at = stagger ? (i / N) * dur : 0, lt = fcClamp01((el - at) / vdur), e = ease(lt);
                sides.forEach((_, si) => { cur[si][i] = targets[si][i] * e; dots[si][i].style.opacity = (lt > 0 && has(axes, si, i)) ? 1 : 0; });
            }
            paint();
            if (el < total) raf = requestAnimationFrame(frame);
            else { sides.forEach((_, si) => cur[si] = targets[si].slice()); paint(); raf = 0; finishBuild(); }
        };
        raf = requestAnimationFrame(frame);
    };

    const morph = (targets, axes) => {
        if (raf) cancelAnimationFrame(raf);
        finishBuild();
        const from = cur.map(a => a.slice()), dur = 420, start = performance.now();
        const ease = x => 1 - Math.pow(1 - x, 3);
        sides.forEach((_, si) => { for (let i = 0; i < N; i++) dots[si][i].style.opacity = has(axes, si, i) ? 1 : 0; });
        const frame = now => {
            const tt = Math.min(1, (now - start) / dur), e = ease(tt);
            sides.forEach((_, si) => { cur[si] = from[si].map((v, i) => v + (targets[si][i] - v) * e); });
            paint();
            if (tt < 1) raf = requestAnimationFrame(frame); else raf = 0;
        };
        raf = requestAnimationFrame(frame);
    };

    const apply = first => {
        const {axes, p, targets} = compute();
        setText(axes, p);
        setCorners();
        if (first) reveal(targets, axes); else morph(targets, axes);
    };

    return {
        update(...matches) { data = sides.map((_, si) => matches[si] || {}); apply(!started); started = true; },
        setMetric(m) { curMetric = m; if (started) apply(false); }
    };
}

function fcRadarBarsController(body, axisDefs, names, metric, align) {
    const green = FC_RAD_GREEN, red = FC_RAD_RED, hero = axisDefs.length === 1;
    const order = align === 'right' ? [1, 0] : [0, 1];
    const col = si => si === 0 ? green : red;
    const sideName = si => si === 0 ? names.a : names.b;
    let curMetric = metric, data = [{}, {}], built = false;

    const metricLabel = p => p.key === 'wr' ? t('radar_wr_full', 'WINRATE') : t('radar_avg_full', 'AVG KILLS');

    const rowHtml = (ax, side, mi, p) => {
        const color = side === 'A' ? green : red;
        const who = side === 'A' ? names.a : names.b;
        const frac = fcRadarAxisFrac(ax, side, p), val = fcRadarAxisVal(ax, side, p);
        const games = side === 'A' ? ax.gA : ax.gB;
        return `<div class="fc-bar-row"><span class="fc-bar-who" style="color:${color}">${fcRadarEsc(who)}</span><div class="fc-bar-track"><i data-mi="${mi}" data-side="${side}" data-w="${(frac * 100).toFixed(1)}" style="background:${color}"></i></div><span class="fc-bar-val"><span class="fc-bar-num" data-mi="${mi}" data-side="${side}" style="color:${color}">${val}</span> <span class="fc-bar-metric">${metricLabel(p)}</span><span class="fc-bar-games" data-mi="${mi}" data-side="${side}">${games} ${t('radar_games', 'games')}</span></span></div>`;
    };

    const cornerHtml = (si, right) => {
        const ov = computeOverallAverages(data[si] || {});
        const c = col(si);
        const youTag = (si === 0 && names.you) ? ` · ${fcRadarEsc(t('radar_you', 'you'))}` : '';
        return `<div class="fc-pmaps-ov${right ? ' fc-pmaps-ov-r' : ''}"><div class="fc-tov-name"><i style="background:${c}"></i><span>${fcRadarEsc(sideName(si))}${youTag}</span></div><div class="fc-tov-stat">${t('radar_wr_full', 'WINRATE')} <b style="color:${c}">${ov.wr}%</b></div><div class="fc-tov-stat">${t('radar_avg_full', 'AVG KILLS')} <b style="color:${c}">${ov.avgKills}</b></div></div>`;
    };
    const renderCorners = () => {
        const c = body.querySelector('.fc-bars-corners');
        if (c) c.innerHTML = cornerHtml(order[0], false) + cornerHtml(order[1], true);
    };

    const axesNow = () => fcRadarComputeAxes(axisDefs, data[0] || {}, data[1] || {});

    const build = () => {
        const axes = axesNow(), p = fcRadarMetricParams(axes, curMetric);
        let s = `<div class="fc-pmaps-top fc-bars-corners"></div>`;
        if (hero) {
            const ax = axes[0];
            s += `<div class="fc-bars fc-bars-hero"><div class="fc-bars-map">${ax.icon ? `<img src="${ax.icon}" alt="">` : ''}<span>${fcRadarEsc(ax.name)}</span></div><div class="fc-bars-rows">${rowHtml(ax, 'A', 0, p)}${rowHtml(ax, 'B', 0, p)}</div></div>`;
        } else {
            s += `<div class="fc-bars">` + axes.map((ax, mi) => `<div class="fc-bars-card"><div class="fc-bars-maphdr">${ax.icon ? `<img src="${ax.icon}" alt="">` : ''}<span>${fcRadarEsc(ax.name)}</span></div>${rowHtml(ax, 'A', mi, p)}${rowHtml(ax, 'B', mi, p)}</div>`).join('') + `</div>`;
        }
        body.innerHTML = s;
        renderCorners();
        Array.from(body.querySelectorAll('.fc-bar-row')).forEach((row, idx) => {
            const bar = row.querySelector('.fc-bar-track > i');
            if (bar) setTimeout(() => { bar.style.width = bar.dataset.w + '%'; }, 80 + idx * 90);
        });
        built = true;
    };

    const retarget = () => {
        const axes = axesNow(), p = fcRadarMetricParams(axes, curMetric), lbl = metricLabel(p);
        body.querySelectorAll('.fc-bar-track > i').forEach(bar => {
            const ax = axes[+bar.dataset.mi];
            bar.dataset.w = (fcRadarAxisFrac(ax, bar.dataset.side, p) * 100).toFixed(1);
            bar.style.width = bar.dataset.w + '%';
        });
        body.querySelectorAll('.fc-bar-num').forEach(n => {
            const ax = axes[+n.dataset.mi];
            n.textContent = fcRadarAxisVal(ax, n.dataset.side, p);
        });
        body.querySelectorAll('.fc-bar-games').forEach(g => {
            const ax = axes[+g.dataset.mi];
            const games = g.dataset.side === 'A' ? ax.gA : ax.gB;
            g.textContent = `${games} ${t('radar_games', 'games')}`;
        });
        body.querySelectorAll('.fc-bar-metric').forEach(el => el.textContent = lbl);
        renderCorners();
    };

    return {
        update(...matches) { data = [matches[0] || {}, matches[1] || {}]; if (!built) build(); else retarget(); },
        setMetric(m) { curMetric = m; if (built) retarget(); }
    };
}
