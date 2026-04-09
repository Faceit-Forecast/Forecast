/*
 * Copyright (c) 2025 TerraMiner. All Rights Reserved.
 */
const matchRoomModule = new Module("matchroom", async () => {
    matchRoomModule.teamCache = new Map()
    matchRoomModule.temporaryFaceitBugFix();
    const matchId = extractMatchId();

    try {
        if (!matchId) return;
        await getMatchWinRates(matchId);
    } catch (err) {
        error("Error when retrieving match statistics", err);
    }
}, async () => {
    matchRoomModule.teamCache.clear()
})

async function getMapIconUrl(mapName) {
    try {
        const config = await loadMapsConfig();
        if (!config || !config.maps) return null;

        let mapData = config.maps[mapName];
        if (!mapData) {
            mapData = Object.values(config.maps).find(m => m.faceitName === mapName);
        }

        const cdnUrl = await getCdnUrl();
        if (mapData && mapData.icon) {
            return `${cdnUrl}/web/images/maps/48/${mapData.icon}`;
        }

        const mapId = mapData ? null : mapName;
        if (mapId) {
            return `${cdnUrl}/web/images/maps/48/map_icon_${mapId}.png`;
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

function getKDColorClass(kd) {
    const v = parseFloat(kd);
    if (isNaN(v)) return '';
    if (v < 0.99) return 'fc-stat-red';
    if (v <= 1.2) return 'fc-stat-yellow';
    return 'fc-stat-green';
}

function formatGamesWR(totalGames, wins) {
    const wr = Math.round(wins / totalGames * 100);
    return {wr, games: totalGames};
}

async function setupPlayerCardMatchData(playerId, targetNode, matchAmount, isClassic) {
    let tableId = `session-${matchRoomModule.sessionId}-player-table-${playerId}`
    if (targetNode.querySelector("[class~=tableId]")) return null
    let template = isClassic ? CLASSIC_PLAYER_WINRATE_TABLE_TEMPLATE : PLAYER_WINRATE_TABLE_TEMPLATE;
    let htmlResource = template.cloneNode(true);
    const statsTextEl = htmlResource.querySelector('.fc-panel-stats-text');
    if (statsTextEl) statsTextEl.textContent = t('stats_last_n_matches', `Stats for last ${matchAmount} matches`).replace('{0}', matchAmount);
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

    for (const mapName of [...allMaps].sort()) {
        const d1 = team1Matches[mapName];
        const d2 = team2Matches[mapName];
        const iconUrl = await getMapIconUrl(mapName);
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

async function getMatchWinRates(matchId, maxRetries = 5, retryDelay = 3000) {
    if (!matchId) {
        error("Match ID is not provided!");
        return
    }

    let matchStats = null;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        matchStats = await fetchMatchStats(matchId);
        if (matchStats && matchStats.teams) break;

        if (attempt < maxRetries) {
            println(`Match ${matchId} not available yet, retrying in ${retryDelay / 1000}s (attempt ${attempt}/${maxRetries})...`);
            await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
    }

    if (!matchStats || !matchStats.teams) {
        error("Error when retrieving match statistics: Incorrect match structure.");
        return
    }

    const settings = await getSettings({
        teamMapWinrate: true,
        playerMapWinrate: true,
        classicTeamView: false,
        classicPlayerView: false,
        sliderValue: 30
    });

    displayWinRates(matchStats, settings);
}

async function findUserCard(nickname, callback) {
    let nickNodeSelector = sel('matchroom.nickNode');
    matchRoomModule.doAfterNodeAppearWithCondition(nickNodeSelector, (node) => node.innerText === nickname, (node) => {
        const parentNode = getNthParent(node, 4)
        matchRoomModule.doAfter(() => parentNode.querySelector(sel('matchroom.ratingsContainer')), (ratingsNode) => {
            if (!matchRoomModule.isProcessedNode(ratingsNode)) {
                matchRoomModule.processedNode(ratingsNode);
                callback(ratingsNode);
            }
        }, 50)
    }, `${nickNodeSelector}-${nickname}`)
}

async function calculateStats(team, playerId, nickname, matchAmount, settings) {
    let gameType = extractGameType("cs2")
    let data = await fetchPlayerInGameStats(playerId, gameType, matchAmount);

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
        await findUserCard(nickname, async userCardElement => {
            let htmlResource = await setupPlayerCardMatchData(playerId, userCardElement, matchAmount, settings.classicPlayerView)
            if (!htmlResource) return;

            const playerStats = teamMap.get(playerId);
            if (!playerStats) return;

            if (settings.classicPlayerView) {
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

    const matchAmount = settings.sliderValue;

    const team1Promises = team1["roster"].map(player =>
        calculateStats(`${team1.name}$roster1`, player["player_id"], player["nickname"], matchAmount, settings)
    );
    const team2Promises = team2["roster"].map(player =>
        calculateStats(`${team2.name}$roster2`, player["player_id"], player["nickname"], matchAmount, settings)
    );

    await Promise.all([...team1Promises, ...team2Promises]);

    if (settings.teamMapWinrate) {
        let teamTableNodeId = `team-table-${matchRoomModule.sessionId}`
        await matchRoomModule.doAfterAllNodeAppear(sel('matchroom.teamTable'), async (node) => {
            let existingTeamTableNode = node.querySelector(`[class*=fc-team-panel]`);
            if (existingTeamTableNode) {
                if (existingTeamTableNode.classList.contains(teamTableNodeId)) return
                else existingTeamTableNode.remove()
            }
            const targetNode = node.matches(sel('matchroom.infoName')) ? node : node.querySelector(sel('matchroom.teamTable'));
            if (!targetNode) return;
            if (matchRoomModule.isProcessedNode(targetNode)) return;
            matchRoomModule.processedNode(targetNode);

            let innerNode = targetNode.querySelector('[class*=forecast-banner]') ?? targetNode.querySelector(sel('matchroom.overviewStack'))

            let template = settings.classicTeamView ? CLASSIC_TEAM_WINRATE_TABLE_TEMPLATE : TEAM_WINRATE_TABLE_TEMPLATE;
            let htmlResource = template.cloneNode(true)
            setupBrandIcon(htmlResource, 24, 24)

            const statsTextEl = htmlResource.querySelector('.fc-panel-stats-text');
            if (statsTextEl) statsTextEl.textContent = t('stats_last_n_matches', `Stats for last ${matchAmount} matches`).replace('{0}', matchAmount);

            node.style.overflowBlock = 'unset';
            htmlResource.classList.add(teamTableNodeId)
            innerNode.after(htmlResource);

            let team1Matches = {}, team2Matches = {};
            matchRoomModule.teamCache.forEach((teamMap, teamNameRaw) => {
                const roster = teamNameRaw.split("$").pop();
                const teamName = teamNameRaw.split("$")[0];
                const matches = calculateTeamMatches(teamMap);

                if (roster === 'roster1') {
                    team1Matches = matches;
                } else {
                    team2Matches = matches;
                }

                htmlResource.querySelectorAll(`.${roster}-name`).forEach(el => el.textContent = teamName);
            });

            await (settings.classicTeamView
                ? displayClassicTeamStats(htmlResource, team1Matches, team2Matches)
                : displayTeamStats(htmlResource, team1Matches, team2Matches));
        })
    }
}
