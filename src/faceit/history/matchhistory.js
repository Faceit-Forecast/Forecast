/*
 * Copyright (c) 2025 TerraMiner. All Rights Reserved.
 */

const MATCHES_PER_LOAD = 30;

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
            matchNode.prev = this.tail;
            this.tail = matchNode;
        }

        return matchNode;
    }

    clear() {
        this.nodes.clear();
        this.head = null;
        this.tail = null;
    }

    get size() {
        return this.nodes.size;
    }
}

class MatchNodeByMatchStats {
    constructor(node, matchId, index) {
        this.node = node;
        this.matchId = matchId
        this.matchStats = null;
        this.rounds = 0;
        this.index = index
        this.nodeId = `extended-stats-node-${index}`

        this.prev = null;
        this.next = null;

        this.elo = null;
        this.eloDiff = null;
        this.eloCalculated = false;

        this.setupMatchCounterArrow()
    }

    isLast() {
        return this.next === null;
    }

    isFirst() {
        return this.prev === null;
    }

    async calculateEloDiff(playerId) {
        if (this.eloCalculated) return this.eloDiff;
        if (this.elo === null) return null;

        if (this.isLast()) {
            try {
                const eloBeforeMatch = await fetchEloByMatchId(this.matchId, playerId);
                if (eloBeforeMatch !== null) {
                    this.eloDiff = this.elo - eloBeforeMatch;
                    this.eloCalculated = true;
                }
            } catch (e) {
                console.error(`Failed to fetch elo for last match ${this.matchId}:`, e);
            }
        } else {
            const nextElo = this.next?.elo;
            if (nextElo !== null && nextElo !== undefined) {
                this.eloDiff = this.elo - nextElo;
                this.eloCalculated = true;
            }
        }

        return this.eloDiff;
    }

    setElo(eloValue) {
        this.elo = eloValue;
    }

    loadMatchStats(playerId, detailedMatchInfo) {
        if (!detailedMatchInfo) {
            error(`No detailed match info found for matchId: ${this.matchId}`);
            return;
        }

        let player = findPlayerInTeamsById(detailedMatchInfo.rounds[0].teams, playerId);
        if (!player) {
            error(`No stats found for playerId: ${playerId} in matchId: ${this.matchId}`);
            return;
        }

        this.matchStats = player["player_stats"];
        this.rounds = Number.parseInt(detailedMatchInfo.rounds[0].round_stats["Rounds"], 10);
        this.setupStatsToNode(playerId, detailedMatchInfo);
    }

    setupStatsToNode(playerId, detailedMatchInfo) {
        if (!this.matchStats) return;
        const innerNode = this.node?.querySelector("div")?.lastChild
        const scoreNode = innerNode?.children[1]?.lastChild
        if (scoreNode) {

            scoreNode.parentElement.parentElement.style.overflow = "visible"

            let popup = this.node.querySelector("[id*=extended-stats-node-]");
            let tableNotExist = !popup;

            if (tableNotExist) {
                popup = getHtmlResource("src/visual/tables/match-history-popup.html").cloneNode(true)
                popup.id = this.nodeId
            }

            if (!this.popup) {
                this.popup = new MatchroomPopup(popup)
                this.popup.attachToElement(detailedMatchInfo, playerId)
            }

            if (tableNotExist) {
                scoreNode.lastChild.style.justifyContent = "center";
                scoreNode.appendChild(popup)
                matchHistoryModule.removalNode(popup)
            }
        }
        const eloNode = innerNode?.children[2]?.lastChild?.lastChild?.lastChild
        if (!eloNode) return;

        let eloValue = Number.parseInt(eloNode.innerText?.replace(/[\s,._]/g, ''), 10);
        if (isNaN(eloValue)) return;

        this.setElo(eloValue);
        this.eloNode = eloNode;
    }

    async applyEloDiff(playerId) {
        const eloDiff = await this.calculateEloDiff(playerId);
        if (eloDiff !== null && this.eloNode) {
            let eloSummaryNode = document.createElement('span');
            eloSummaryNode.innerText = `${eloDiff > 0 ? '+' : ''}${eloDiff}`;
            let parentElement = this.eloNode.parentElement;
            parentElement.style.flexDirection = 'row'
            parentElement.style.alignItems = 'baseline'
            parentElement.style.gap = '3px'
            let green = 'rgb(61,255,108)'
            let red = 'rgb(255, 0, 43)'
            let white = 'rgb(255, 255, 255)'
            eloSummaryNode.style.color = `${eloDiff > 0 ? green : eloDiff < 0 ? red : white}`
            eloSummaryNode.style.fontSize = 'smaller'
            parentElement.appendChild(eloSummaryNode);
        }
    }

    setupMatchCounterArrow() {
        let matchNumber = (this.index + 1)
        if (matchNumber % 30 !== 0) return
        let arrowId = `arrow-${matchNumber / 30}`

        if (!document.getElementById(arrowId)) {
            const arrow = getHtmlResource("src/visual/tables/match-counter-arrow.html").cloneNode(true);
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

    let lastIndex = 0
    let tableElement;
    let tableHeadElement;

    const matchChain = new MatchNodeChain();

    let tableRowAttribute = `forecast-matchhistory-row-${matchHistoryModule.sessionId}`;
    let langKey = extractLanguage();
    let gameType = extractGameType("cs2");
    let prefix = `/${langKey}/${gameType}/room/`;
    let suffix = `/scoreboard`;
    let selector = `a[href^="${prefix}"][href$="${suffix}"]:not([${tableRowAttribute}]):not(:has([id*=extended-stats-node]))`;
    const matchIdRegex = /\/room\/([^/]+)\/scoreboard/;

    await matchHistoryModule.doAfterAllNodeAppearPack(selector, async function callback(nodes, attempt) {
        const nodesArr = filterUnmarkedNodes(nodes);
        const attempts = attempt || 0;

        if (!shouldContinue(nodesArr, attempts, nodes, callback)) return;

        initializeTableElements(nodesArr);

        const nodeArrays = prepareNodeArrays(nodesArr);

        if (nodeArrays.length === 0) return;

        await processNodeBatches(nodeArrays);
    });

    function initializeTableElements(nodesArr) {
        if (!tableElement) {
            tableElement = nodesArr[0].parentNode.children;
        }
        if (!tableHeadElement) {
            tableHeadElement = tableElement[0];
        }
    }

    function prepareNodeArrays(nodesArr) {
        const filteredNodes = nodesArr.filter(node => filterAndMarkNode(node));
        return chunkArray(filteredNodes, MATCHES_PER_LOAD);
    }

    function filterAndMarkNode(node) {
        const shouldInclude = tableHeadElement !== node && !node.hasAttribute(tableRowAttribute);
        if (shouldInclude) {
            node.setAttribute(tableRowAttribute, '');
        }
        return shouldInclude;
    }

    async function processNodeBatches(nodeArrays) {
        const tableNodesArray = Array.from(tableElement).filter(element => element.tagName === 'TR');

        for (const nodeArray of nodeArrays) {
            const batch = createBatchFromNodes(nodeArray, tableNodesArray);
            await loadMatchStatsForBatch(batch);
        }
    }

    function createBatchFromNodes(nodeArray, tableNodesArray) {
        const batch = [];

        for (let node of nodeArray) {
            const index = calculateNodeIndex(tableNodesArray, node);
            if (index === -1) continue;

            lastIndex = index + 1;
            const matchId = extractMatchId(node);


            const matchNode = new MatchNodeByMatchStats(node.children[0], matchId, index);

            matchChain.append(matchNode);
            batch.push(matchNode);
        }

        return batch;
    }

    function calculateNodeIndex(tableNodesArray, node) {
        if (lastIndex !== -1) return lastIndex;
        return tableNodesArray.indexOf(node) - 1;
    }

    function extractMatchId(node) {
        const match = node.href.match(matchIdRegex);
        return match[1];
    }

    async function loadMatchStatsForBatch(batch) {
        let id = await playerId()

        await Promise.all(batch.map(node =>
            getFromCacheOrFetch(node.matchId, fetchMatchStatsDetailed)
                .then(result => node.loadMatchStats(id, result))
        ));

        for (const node of batch) {
            await node.applyEloDiff(id);
        }
    }
}, async () => {

});

function filterUnmarkedNodes(nodes) {
    return [...nodes].filter((e) =>
        !e.parentNode.parentNode.parentNode.parentNode.parentNode.parentElement.hasAttribute("marked-as-bug")
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

async function fetchEloByMatchId(matchId, playerId) {
    let matchStats = await fetchOldMatchStats(matchId)
    let player = findPlayerInFactionsById(matchStats, playerId)
    return player?.elo ?? null
}

function findPlayerInFactionsById(matchData, playerId) {
    const teams = matchData.teams;
    if (!teams) return null;

    for (const factionKey of ['faction1', 'faction2']) {
        const roster = teams[factionKey]?.roster;
        if (roster) {
            const player = roster.find(p => p.id === playerId);
            if (player) return player;
        }
    }

    return null;
}