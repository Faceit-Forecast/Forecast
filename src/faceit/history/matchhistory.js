/*
 * Copyright (c) 2025 TerraMiner. All Rights Reserved.
 */

const MATCHES_PER_LOAD = 30;

const green = 'rgb(61,255,108)';
const red = 'rgb(255, 0, 43)';
const white = 'rgb(255, 255, 255)';

const COLUMNS = {
    map:   0,
    score: 1,
    elo:   2,
    kda:   3,
    adr:   4,
    kd:    5,
    kr:    6
};

class MatchNodeChain {
    constructor() {
        this.nodes = new Map();
        this.head = null;
        this.tail = null;
    }

    has(matchId) {
        return this.nodes.has(matchId);
    }

    get(matchId) {
        return this.nodes.get(matchId);
    }

    append(matchNode) {
        if (this.nodes.has(matchNode.matchId)) {
            return this.nodes.get(matchNode.matchId);
        }

        this.nodes.set(matchNode.matchId, matchNode);

        if (!this.head) {
            this.head = matchNode;
            this.tail = matchNode;
        } else {
            this.tail.next = matchNode;
            this.tail = matchNode;
        }

        return matchNode;
    }
}

class MatchNodeByMatchStats {
    constructor(node, matchId, index, settings) {
        this.node = node;
        this.matchId = matchId
        this.matchStats = null;
        this.rounds = 0;
        this.index = index
        this.nodeId = `extended-stats-node-${index}`
        this.settings = settings;
        this.next = null;

        this.elo = null;
        this.teamAvgElo = null;
        this.enemyAvgElo = null;

        this.setupMatchCounterArrow()
    }

    isLast() {
        return !this.next;
    }

    setElo(eloValue) {
        this.elo = eloValue;
    }

    loadMatchStats(playerId, cachedStats) {
        if (!cachedStats?.rounds?.[0]) {
            error(`No cached stats found for matchId: ${this.matchId}`);
            return;
        }

        const player = findPlayerInTeamsById(cachedStats.rounds[0].teams, playerId);
        if (!player) {
            error(`No stats found for playerId: ${playerId} in matchId: ${this.matchId}`);
            return;
        }

        this.cachedStats = cachedStats;
        this.matchStats = player.player_stats;
        this.rounds = Number.parseInt(cachedStats.rounds[0].round_stats.Rounds, 10) || 0;

        const teams = cachedStats.rounds[0].teams;
        const myTeam = findTeamByPlayerId(teams, playerId);
        const enemyTeam = teams.find(t => t !== myTeam);

        const teammates = myTeam.players.filter(p => p.player_id !== playerId);
        const teamAvgElo = teammates.length > 0
            ? Math.round(teammates.reduce((sum, p) => sum + p.elo, 0) / teammates.length)
            : null;
        const enemyAvgElo = enemyTeam && enemyTeam.players.length > 0
            ? Math.round(enemyTeam.players.reduce((sum, p) => sum + p.elo, 0) / enemyTeam.players.length)
            : null;

        if (player.elo) {
            this.setElo(player.elo);
        }

        this.teamAvgElo = teamAvgElo;
        this.enemyAvgElo = enemyAvgElo;

        this.setupStatsToNode(playerId, cachedStats);
    }

    setupStatsToNode(playerId, cachedStats) {
        if (!this.matchStats) return;

        this.col = {};
        for (const [name, index] of Object.entries(COLUMNS)) {
            this.col[name] = this.node?.children[index] ?? null;
        }

        if (this.col.score) {

            this.col.score.parentElement.parentElement.style.overflow = "visible"

            let popup = this.node.querySelector("[id*=extended-stats-node-]");
            let tableNotExist = !popup;

            if (tableNotExist) {
                popup = MATCH_HISTORY_POPUP_TEMPLATE.cloneNode(true)
                popup.id = this.nodeId
            }

            if (!this.popup) {
                this.popup = new MatchroomPopup(popup, this.settings)
                this.popup.attachToElement(cachedStats, playerId)
            }

            if (tableNotExist) {
                this.col.score.querySelector('div').style.gap = 'unset'
                this.col.score.querySelector('div').lastChild.style.justifyContent = "center";
                this.col.score.querySelector('div').appendChild(popup);
                matchHistoryModule.removalNode(popup)
            }
        }

        if (this.settings?.showFCR) {
            if (this.node.querySelector('[class*="fcr-fc"]')) return;
            const rating = this.matchStats.Rating;
            const ratingValue = parseFloat(rating);
            let fcrText = rating !== null ? rating + '%' : '-';
            let fcrNode = document.createElement("td");
            fcrNode.textContent = fcrText;

            if (this.settings?.coloredStatsFCR !== false && !isNaN(ratingValue)) {
                if (ratingValue >= 20) {
                    fcrNode.style.color = green;
                } else if (ratingValue >= 15) {
                    fcrNode.style.color = 'rgb(255, 200, 0)';
                } else {
                    fcrNode.style.color = red;
                }
            } else {
                fcrNode.style.color = white;
            }

            if (this.col.kr) {
                fcrNode.className = this.col.kr.className;
                fcrNode.classList.add('fcr-fc');
                this.col.kr.after(fcrNode);
            }
        }

        if (this.settings?.showAVGElo) {
            if (this.node.querySelector('[class*="avg-elo-fc"]')) return;

            let avgEloNode = document.createElement("td");
            avgEloNode.classList.add('avg-elo-fc');

            const cell = document.createElement("div");
            cell.className = "avg-elo-cell";

            const badges = document.createElement("div");
            badges.className = "avg-elo-badges";

            const badgeT = document.createElement("div");
            badgeT.className = "avg-elo-badge avg-elo-badge-team";
            badgeT.textContent = "T";

            const badgeE = document.createElement("div");
            badgeE.className = "avg-elo-badge avg-elo-badge-enemy";
            badgeE.textContent = "E";

            badges.appendChild(badgeT);
            badges.appendChild(badgeE);

            const values = document.createElement("div");
            values.className = "avg-elo-values";

            const teamVal = document.createElement("span");
            teamVal.className = "avg-elo-value avg-elo-value-team";
            teamVal.textContent = this.teamAvgElo != null ? formatElo(this.teamAvgElo) : '-';

            const enemyVal = document.createElement("span");
            enemyVal.className = "avg-elo-value avg-elo-value-enemy";
            enemyVal.textContent = this.enemyAvgElo != null ? formatElo(this.enemyAvgElo) : '-';

            values.appendChild(teamVal);
            values.appendChild(enemyVal);

            cell.appendChild(badges);
            cell.appendChild(values);
            avgEloNode.appendChild(cell);

            if (this.col.elo) {
                avgEloNode.className += ' ' + this.col.elo.className;
                avgEloNode.classList.add('avg-elo-fc');
                this.col.elo.after(avgEloNode);
            }
        }

        this.setupStats();
    }

    setupStats() {
        const kdaNode = this.col.kda;
        const adrNode = this.col.adr;
        const kdNode = this.col.kd;
        const krNode = this.col.kr;

        if (!kdaNode) return;

        const kdaValues = kdaNode.innerText?.split('/').map(v => parseNumber(v)) || [];
        const [k, d, a] = kdaValues;
        const kd = d ? k / d : 0;

        const shouldRound = this.settings?.roundedStats !== false;

        if (this.settings?.coloredStatsKDA !== false) {
            const kdaWrapperNode = document.createElement('td');
            const newKdaNode = createCompositeCell('div',[
                {text: k, condition: kd >= 1.0},
                {text: "/", condition: null, isSlash: true},
                {text: d, condition: kd >= 1.0},
                {text: "/", condition: null, isSlash: true},
                {text: a, condition: null},
            ]);
            kdaWrapperNode.className = kdaNode.className;
            kdaWrapperNode.appendChild(newKdaNode)

            matchHistoryModule.replaceNodeWith(kdaNode, kdaWrapperNode)
        }

        if (this.settings?.coloredStatsADR !== false) {
            const adr = parseNumber(adrNode?.innerText, true);
            const adrDisplay = shouldRound ? adr.toFixed(1) : adrNode?.innerText;
            matchHistoryModule.replaceNodeWithColored('td', adrNode, adrDisplay, adr >= 75);
        }

        if (this.settings?.coloredStatsKD !== false) {
            const kdDisplay = shouldRound ? kd.toFixed(1) : kdNode?.innerText;
            matchHistoryModule.replaceNodeWithColored('td', kdNode, kdDisplay, kd >= 1);
        }

        if (this.settings?.coloredStatsKR !== false) {
            const kr = parseNumber(krNode?.innerText, true);
            const krDisplay = shouldRound ? kr.toFixed(1) : krNode?.innerText;
            matchHistoryModule.replaceNodeWithColored('td', krNode, krDisplay, kr >= 0.7);
        }
    }

    setupMatchCounterArrow() {
        if (this.settings?.matchCounter === false) return;

        let matchNumber = (this.index + 1)
        if (matchNumber % 30 !== 0) return
        let arrowId = `arrow-${matchNumber / 30}`

        if (!document.getElementById(arrowId)) {
            const arrow = MATCH_COUNTER_ARROW_TEMPLATE.cloneNode(true);
            arrow.id = arrowId;
            arrow.style.position = "relative";
            arrow.style.zIndex = "2";
            arrow.style.bottom = "0px"
            arrow.style.left = "4px"
            arrow.style.position = "absolute"
            this.node.querySelector("div").prepend(arrow)

            const arrowElements = arrow.querySelectorAll("*");
            arrowElements.forEach(el => {
                el.style.position = "relative";
                el.style.zIndex = "2";
            });

            arrow.querySelector("[class~=match-counter-arrow-square]").innerText = matchNumber;
        }
    }
}

const matchHistoryModule = new Module("matchhistory", async () => {
    matchHistoryModule.temporaryFaceitBugFix();

    let playerNick = extractPlayerNick();
    let _playerId = null

    async function playerId() {
        if (_playerId) return _playerId
        _playerId = (await fetchPlayerStatsByNickName(playerNick)).player_id
        return _playerId;
    }

    let _settings = null

    async function settings() {
        if (_settings) return _settings

        _settings = await getSettings({
            matchCounter: true,
            coloredStatsKDA: true,
            coloredStatsADR: true,
            coloredStatsKD: true,
            coloredStatsKR: true,
            showFCR: true,
            coloredStatsFCR: true,
            showAVGElo: true,
            roundedStats: false
        });

        return _settings
    }

    let tableElement;
    let tableBodyElement;
    let tableHeadElement;

    const matchChain = new MatchNodeChain();

    let tableRowAttribute = `forecast-matchhistory-row-${matchHistoryModule.sessionId}`;
    let langKey = extractLanguage();
    let gameType = extractGameType("cs2");
    let prefix = `/${langKey}/${gameType}/room/`;
    let suffix = `/scoreboard`;
    let selector = `tbody > a[href^="${prefix}"][href$="${suffix}"]:not([${tableRowAttribute}]):not(:has([id*=extended-stats-node]))`;
    const matchIdRegex = /\/room\/([^/]+)\/scoreboard/;

    await matchHistoryModule.doAfterAllNodeAppearPack(selector, async function callback(nodes, attempt) {
        if (tableBodyElement && !tableBodyElement.isConnected
            || tableHeadElement && !tableHeadElement.isConnected
        ) {
            tableElement = null
            tableHeadElement = null
            tableBodyElement = null
        }

        const nodesArr = filterUnmarkedNodes(nodes);
        const attempts = attempt || 0;

        if (!shouldContinue(nodesArr, attempts, nodes, callback)) return;

        await initializeTableElements(nodesArr);

        const nodeArrays = prepareNodeArrays(nodesArr);

        if (nodeArrays.length === 0) return;

        await processNodeBatches(nodesArr, nodeArrays);
    });

    async function initializeTableElements(nodesArr) {
        if (!tableElement || !tableElement.isConnected) {
            tableElement = getNthParent(nodesArr[0],2);
        }
        if (!tableElement) return;
        if (!tableHeadElement) {
            tableHeadElement = tableElement.querySelector("thead");
            if (tableHeadElement) {
                const headerRow = tableHeadElement.querySelector('tr');
                if (headerRow) {
                    const headerElo = headerRow.children[COLUMNS.elo];
                    const headerKR = headerRow.children[COLUMNS.kr];

                    if ((await settings()).showAVGElo && headerElo) {
                        if (!tableHeadElement.querySelector('[class*="avg-elo-fc-header"]')) {
                            let headerAVGElo = document.createElement('div')
                            headerAVGElo.className = headerElo.className
                            headerAVGElo.classList.add('avg-elo-fc-header')
                            headerAVGElo.appendChild(document.createTextNode('AVG ELO'))
                            headerElo.after(headerAVGElo)
                        }
                    }

                    if ((await settings()).showFCR && headerKR) {
                        if (!tableHeadElement.querySelector('[class*="fcr-fc-header"]')) {
                            let headerFCR = document.createElement('div')
                            headerFCR.className = headerKR.className
                            headerFCR.classList.add('fcr-fc-header')
                            headerFCR.appendChild(document.createTextNode('FCR'))
                            headerKR.after(headerFCR)
                        }
                    }
                }
            }
        }
        if (!tableBodyElement) {
            tableBodyElement = tableElement.querySelector("tbody");
        }
    }

    function prepareNodeArrays(nodesArr) {
        const filteredNodes = nodesArr.filter(node => filterAndMarkNode(node));
        return chunkArray(filteredNodes, MATCHES_PER_LOAD);
    }

    function filterAndMarkNode(node) {
        const shouldInclude = !node.hasAttribute(tableRowAttribute);
        if (shouldInclude) {
            node.setAttribute(tableRowAttribute, '');
        }
        return shouldInclude;
    }

    async function processNodeBatches(nodesArr, nodeArrays, recursive = false) {
        let tableNodesArray
        try {
            tableNodesArray = Array.from(tableBodyElement.children).filter(element => element.tagName === 'A');
        } catch (e) {
            if (!recursive) {
                await initializeTableElements(nodesArr);
                await processNodeBatches(nodesArr, nodeArrays, true)
            }
            return;
        }
        for (const nodeArray of nodeArrays) {
            const batch = await createBatchFromNodes(nodeArray, tableNodesArray);
            await loadMatchStatsForBatch(batch);
        }
    }

    async function createBatchFromNodes(nodeArray, tableNodesArray) {
        const batch = [];
        let _settings = await settings();

        for (let node of nodeArray) {
            if (!node.isConnected) continue;
            const index = tableNodesArray.indexOf(node);
            if (index === -1) continue;

            const matchId = extractMatchId(node);

            const matchNode = new MatchNodeByMatchStats(node.children[0], matchId, index, _settings);

            matchChain.append(matchNode);
            batch.push(matchNode);
        }

        return batch;
    }


    function extractMatchId(node) {
        const match = node.href.match(matchIdRegex);
        return match[1];
    }

    async function loadMatchStatsForBatch(batch) {
        let id = await playerId()

        await Promise.all(batch.map(async node => {
                const cachedStats = await getFromCacheOrFetch(
                    node.matchId,
                    fetchMatchStatsDetailed,
                    fetchV3MatchStats
                );
                if (cachedStats) {
                    node.loadMatchStats(id, cachedStats);
                }
            }
        ));
    }
}, async () => {});

function filterUnmarkedNodes(nodes) {
    return [...nodes].filter((e) =>
        !getNthParent(e,9).hasAttribute("marked-as-bug")
    );
}

function shouldContinue(nodesArr, attempts, nodes, callback) {
    if (nodesArr.length === 0) {
        if (attempts <= 10) {
            setTimeout(async () => await callback(nodes, attempts + 1), 100);
        }
        return false;
    }
    return true;
}

function findPlayerInTeamsById(teams, playerId) {
    for (const team of teams) {
        const player = team.players.find(player => player.player_id === playerId);
        if (player) return player;
    }
    return null;
}

function findTeamByPlayerId(teams, playerId) {
    for (const team of teams) {
        const player = team.players.find(player => player.player_id === playerId);
        if (player) return team;
    }
    return null;
}

function formatElo(value) {
    return Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '\u00A0');
}

