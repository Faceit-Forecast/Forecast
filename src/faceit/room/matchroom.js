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

async function setupPlayerCardMatchData(playerId, nickname, targetNode) {
    let tableId = `session-${matchRoomModule.sessionId}-player-table-${playerId}`
    if (targetNode.querySelector("[class~=tableId]")) return null
    let htmlResource = PLAYER_WINRATE_TABLE_TEMPLATE.cloneNode(true);
    htmlResource.querySelector('[class=player-name]').textContent = t('player_stats', 'Player Stats')
    setupBrandIcon(htmlResource, 24, 24)
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
    matchRoomModule.doAfterNodeAppearWithCondition(nickNodeSelector, (node) => node.innerText === nickname, (node) => {
        let parentNode = node.parentElement.parentElement.parentElement.parentElement.querySelector('div[class*=styles__ScrollableContainer] > div[class*=RatingsAndStats__Container]')
        if (!matchRoomModule.isProcessedNode(parentNode)) {
            matchRoomModule.processedNode(parentNode);
            callback(parentNode);
        }
    }, `${nickNodeSelector}-${nickname}`)
}


async function calculateStats(team, playerId, matchAmount) {
    let gameType = extractGameType("cs2")
    let data = await fetchPlayerInGameStats(playerId, gameType, matchAmount);
    let nickname = (await fetchPlayerStatsById(playerId))['nickname']

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

        try {
            if (userCardElement.querySelector('.forecast-reputation-container[data-player-id]')) return;

            const rep = await getPlayerReputation(playerId);
            const currentRating = rep ? rep.rating : REPUTATION_NEUTRAL;
            const updatedAt = rep && rep.updatedAt ? rep.updatedAt : null;

            const badgeClone = PLAYER_REPUTATION_BADGE_TEMPLATE.cloneNode(true);
            const container = badgeClone.querySelector('.forecast-reputation-container');
            if (!container) return;
            container.setAttribute('data-player-id', playerId);

            const labelToxic = container.querySelector('[data-label="toxic"]');
            const labelFriendly = container.querySelector('[data-label="friendly"]');
            const labelNeutral = container.querySelector('[data-label="neutral"]');
            [labelToxic, labelFriendly, labelNeutral].forEach(el => el.classList.remove('forecast-reputation-label-current'));
            const currentLabel = container.querySelector(`[data-label="${currentRating}"]`);
            if (currentLabel) {
                currentLabel.classList.add('forecast-reputation-label-current');
                if (updatedAt) {
                    const d = new Date(updatedAt);
                    currentLabel.setAttribute('title', 'Rated: ' + d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
                }
            }

            const btnToxic = container.querySelector('[data-reputation="toxic"]');
            const btnFriendly = container.querySelector('[data-reputation="friendly"]');
            const btnReset = container.querySelector('[data-reputation="reset"]');

            function setReputationUI(rating) {
                [labelToxic, labelFriendly, labelNeutral].forEach(el => el.classList.remove('forecast-reputation-label-current'));
                const label = container.querySelector(`[data-label="${rating}"]`);
                if (label) label.classList.add('forecast-reputation-label-current');
            }

            function setRatedTitle(el) {
                if (el) el.setAttribute('title', 'Rated: ' + new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
            }
            btnToxic.addEventListener('click', async () => {
                await setPlayerReputation(playerId, REPUTATION_TOXIC);
                setReputationUI(REPUTATION_TOXIC);
                setRatedTitle(labelToxic);
                console.log('[FORECAST REPUTATION]', playerId, REPUTATION_TOXIC);
            });
            btnFriendly.addEventListener('click', async () => {
                await setPlayerReputation(playerId, REPUTATION_FRIENDLY);
                setReputationUI(REPUTATION_FRIENDLY);
                setRatedTitle(labelFriendly);
                console.log('[FORECAST REPUTATION]', playerId, REPUTATION_FRIENDLY);
            });
            if (btnReset) {
                btnReset.addEventListener('click', async () => {
                    await resetPlayerReputation(playerId);
                    setReputationUI(REPUTATION_NEUTRAL);
                    const cur = container.querySelector(`[data-label="${REPUTATION_NEUTRAL}"]`);
                    if (cur) cur.removeAttribute('title');
                    console.log('[FORECAST REPUTATION]', playerId, 'reset');
                });
            }

            appendTo(badgeClone, userCardElement);
            matchRoomModule.removalNode(badgeClone);
        } catch (err) {
            error('Reputation badge failed', err);
        }
    });
}


async function displayWinRates(matchDetails) {
    const team1 = matchDetails["teams"]["faction1"];
    const team2 = matchDetails["teams"]["faction2"];

    const matchAmount = await getSettingValue('sliderValue',30);

    const team1Promises = team1["roster"].map(player =>
        calculateStats(`${team1.name}$roster1`, player["player_id"], matchAmount)
    );
    const team2Promises = team2["roster"].map(player =>
        calculateStats(`${team2.name}$roster2`, player["player_id"], matchAmount)
    );

    await Promise.all([...team1Promises, ...team2Promises]);
    let teamTableNodeId = `team-table-${matchRoomModule.sessionId}`
    await matchRoomModule.doAfterAllNodeAppear('[name="info"][class*=Overview__Column]', async (node) => {
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

        let htmlResource = TEAM_WINRATE_TABLE_TEMPLATE.cloneNode(true)
        setupBrandIcon(htmlResource, 24, 24)

        node.style.overflowBlock = 'unset';
        htmlResource.classList.add(teamTableNodeId)
        innerNode.after(htmlResource);

        matchRoomModule.teamCache.forEach((teamMap, teamName) => {
            const teamMatches = calculateTeamMatches(teamMap);
            displayTeamMatches(htmlResource, teamName, teamMatches);
        });
    });

    await setupInlineReputationForLobby(matchDetails);
}

async function setupInlineReputationForLobby(matchDetails) {
    const selectorMatchPlayer = 'div[class*=Overview__Grid] div[class*=ListContentPlayer__SlotWrapper] div[class*=styles__NicknameContainer] > div > div';

    const nicknameToIdMap = new Map();
    [matchDetails.teams.faction1.roster, matchDetails.teams.faction2.roster].forEach(roster => {
        roster.forEach(player => {
            nicknameToIdMap.set(player.nickname, player.player_id);
        });
    });

    matchRoomModule.doAfterAllNodeAppear(selectorMatchPlayer, async (node) => {
        const container = node.parentElement;
        if (container.hasAttribute('data-processed-reputation')) return;
        container.setAttribute('data-processed-reputation', 'true');

        const nickname = node.textContent.trim();
        const playerId = nicknameToIdMap.get(nickname);
        if (!playerId) return;

        try {
            const reputation = await getPlayerReputation(playerId);

            const template = PLAYER_REPUTATION_INLINE_TEMPLATE.cloneNode(true);
            const inlineEl = template.firstElementChild || template;

            if (reputation?.rating === REPUTATION_TOXIC || reputation?.rating === REPUTATION_FRIENDLY) {
                const activeBtn = inlineEl.querySelector(`.reputation-${reputation.rating}`);
                if (activeBtn) activeBtn.classList.add('active');
            }

            const toxicBtn = inlineEl.querySelector('.reputation-toxic');
            const friendlyBtn = inlineEl.querySelector('.reputation-friendly');

            toxicBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                await setPlayerReputation(playerId, REPUTATION_TOXIC);
                toxicBtn.classList.add('active');
                friendlyBtn.classList.remove('active');
                console.log('[REPUTATION INLINE]', playerId, nickname, 'toxic');
            });

            friendlyBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                await setPlayerReputation(playerId, REPUTATION_FRIENDLY);
                friendlyBtn.classList.add('active');
                toxicBtn.classList.remove('active');
                console.log('[REPUTATION INLINE]', playerId, nickname, 'friendly');
            });

            container.appendChild(inlineEl);
            matchRoomModule.removalNode(inlineEl);
        } catch (err) {
            error('Inline reputation failed', err);
        }
    });
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

