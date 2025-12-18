/*
 * Copyright (c) 2025 TerraMiner. All Rights Reserved.
 */
let teamCache = new Map()

const matchRoomModule = new Module("matchroom", async () => {
    matchRoomModule.temporaryFaceitBugFix();
    const matchId = extractMatchId();

    try {
        if (!matchId) return;
        await getMatchWinRates(matchId);
    } catch (err) {
        error("Error when retrieving match statistics", err);
    }
}, async () => {
    teamCache.clear()
})

async function setupPlayerCardMatchData(playerId, nickname, targetNode) {
    let tableId = `session-${matchRoomModule.sessionId}-player-table-${playerId}`
    if (targetNode.querySelector("[class~=tableId]")) return null
    let htmlResource = getHtmlResource('src/visual/tables/player.html').cloneNode(true);
    htmlResource.querySelector('[class=player-name]').textContent = `Player Stats`
    setupBrandIcon(htmlResource)
    appendTo(htmlResource, targetNode)
    let table = htmlResource.querySelector("[class~=player-table]")
    table.classList.add(tableId)
    return table
}

function calculateTeamMatches(teamMap) {
    const teamMatches = {};

    teamMap.forEach(({maps}) => {
        maps.forEach((data, mapName) => {
            if (!teamMatches[mapName]) teamMatches[mapName] = {wins: 0, totalGames: 0};
            teamMatches[mapName].wins += data.wins;
            teamMatches[mapName].totalGames += data.totalGames;
        });
    });

    return teamMatches;
}

function displayTeamMatches(htmlResource,teamNameRaw, teamMatches) {
    const roster = teamNameRaw.split("$").pop()
    const teamName = teamNameRaw.split("$")[0]
    addTableTeamTitle(htmlResource,roster, teamName);
    Object.entries(teamMatches)
        .sort(([, dataA], [, dataB]) => dataB.wins / dataB.totalGames - dataA.wins / dataA.totalGames)
        .forEach(([mapName, data]) => {
            const winrate = (data.wins / data.totalGames * 100).toFixed(0);
            addRow(htmlResource.querySelector(`[class~="${roster}"]`), mapName, data.totalGames, winrate)
        });
}

function displayPlayerStats(playerId, playerStats, table) {
    const {maps} = playerStats;

    Array.from(maps.entries())
        .sort(([, {wins: winsA, totalGames: totalA}], [, {wins: winsB, totalGames: totalB}]) =>
            (winsB / totalB) - (winsA / totalA))
        .forEach(([mapName, {totalGames, wins}]) => {
            const winrate = ((wins / totalGames) * 100).toFixed(0);
            addRow(table, mapName, totalGames, winrate);
        });
}


async function getMatchWinRates(matchId) {
    if (!matchId) {
        error("Match ID is not provided!");
        return
    }

    const matchStats = await fetchMatchStats(matchId);

    if (!matchStats) {
        error("Error when retrieving match statistics: Incorrect match structure.");
        return
    }

    await displayWinRates(matchStats);
}

async function findUserCard(nickname, callback) {
    let nickNodeSelector = 'div[class*=styles__PopoverStyled] > div[class*=styles__FixedContainer] > div[class*=styles__NameContainer] > a > h5'
    await matchRoomModule.doAfterNodeAppearWithCondition(nickNodeSelector, (node) => node.innerText === nickname, (node) => {
        let parentNode = node.parentElement.parentElement.parentElement.parentElement.querySelector('div[class*=styles__ScrollableContainer] > div[class*=RatingsAndStats__Container]')
        if (!matchRoomModule.isProcessedNode(parentNode)) {
            matchRoomModule.processedNode(parentNode);
            callback(parentNode);
        }
    }, `${nickNodeSelector}-${nickname}`)
}


async function calculateStats(team, playerId, nickname, matchAmount) {
    let gameType = extractGameType("cs2")
    let data = await fetchPlayerInGameStats(playerId, gameType, matchAmount);

    if (!data.items || data.items.length === 0) {
        return;
    }

    if (!teamCache.has(team)) teamCache.set(team, new Map());

    const teamMap = teamCache.get(team);

    data.items.forEach(item => {
        const stats = item.stats;
        if (stats["Game Mode"] !== "5v5") return;

        const mapName = stats["Map"];
        const result = Number.parseInt(stats["Result"]);

        if (!teamMap.has(playerId)) {
            teamMap.set(playerId, {nickname: stats["Nickname"], maps: new Map()});
        }

        const playerData = teamMap.get(playerId).maps;

        if (!playerData.has(mapName)) {
            playerData.set(mapName, {wins: 0, totalGames: 0});
        }

        const mapData = playerData.get(mapName);
        mapData.wins += result;
        mapData.totalGames += 1;
    });
    await findUserCard(nickname, async userCardElement => {
        let table = await setupPlayerCardMatchData(playerId, nickname, userCardElement)
        if (!table) return;

        const playerStats = teamMap.get(playerId);
        if (playerStats) displayPlayerStats(playerId, playerStats, table);
    });
}


async function displayWinRates(matchDetails) {
    const team1 = matchDetails["teams"]["faction1"];
    const team2 = matchDetails["teams"]["faction2"];

    const matchAmount = await getSettingValue('sliderValue',30);

    const team1Promises = team1["roster"].map(player =>
        calculateStats(`${team1.name}$roster1`, player["player_id"], player["nickname"], matchAmount)
    );
    const team2Promises = team2["roster"].map(player =>
        calculateStats(`${team2.name}$roster2`, player["player_id"], player["nickname"], matchAmount)
    );

    await Promise.all([...team1Promises, ...team2Promises]);
    let teamTableNodeId = `team-table-${matchRoomModule.sessionId}`
    await matchRoomModule.doAfterNodeAppear('[name="info"][class*=Overview__Column]', async (node) => {
        let existingTeamTableNode = node.querySelector(`[class*=team-table]`);
        if (existingTeamTableNode) {
            if (existingTeamTableNode.classList.contains(teamTableNodeId)) return
            else existingTeamTableNode.remove()
        }
        const targetNode = node.matches('[name="info"]') ? node : node.querySelector('[name="info"][class*=Overview__Column]');
        if (!targetNode) return false;
        if (matchRoomModule.isProcessedNode(targetNode)) return false;
        matchRoomModule.processedNode(targetNode);

        let innerNode = targetNode.querySelector('[class*=Overview__Stack]')

        let htmlResource = getHtmlResource('src/visual/tables/team.html').cloneNode(true)
        setupBrandIcon(htmlResource)

        node.style.overflowBlock = 'unset';
        htmlResource.classList.add(teamTableNodeId)
        innerNode.after(htmlResource);

        teamCache.forEach((teamMap, teamName) => {
            const teamMatches = calculateTeamMatches(teamMap);
            displayTeamMatches(htmlResource, teamName, teamMatches);
        });
    })
}

function addTableTeamTitle(htmlResource,roster, title) {
    const titleElement = htmlResource.querySelector(`[class*=${roster}-name]`)
    titleElement.textContent = title
}

function addRow(table, map, games, winPercent) {
    const newRow = table.insertRow();

    const mapCell = newRow.insertCell(0);
    const gamesCell = newRow.insertCell(1);
    const winrateCell = newRow.insertCell(2);

    mapCell.innerHTML = map.replace("de_","").replace(/(\d)/g, " $1").toLocaleUpperCase();
    gamesCell.innerHTML = games;
    winrateCell.innerHTML = winPercent + "%";

    setGradientColor(winrateCell, winPercent);
}

