/*
 * Copyright (c) 2025 TerraMiner. All Rights Reserved.
 */

const MATCHES_PER_LOAD = 30;

const green = 'rgb(61,255,108)';
const red = 'rgb(255, 0, 43)';
const white = 'rgb(255, 255, 255)';

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
    constructor(node, matchId, index, settings, tableHeader) {
        this.node = node;
        this.matchId = matchId
        this.matchStats = null;
        this.rounds = 0;
        this.index = index
        this.nodeId = `extended-stats-node-${index}`
        this.settings = settings;
        this.tableHeader = tableHeader;
        this.next = null;

        this.elo = null;
        this.eloDiff = null;
        this.eloCalculated = false;

        this.setupMatchCounterArrow()
    }

    isLast() {
        return !this.next;
    }

    async calculateEloDiff(playerId, detailedMatchInfo = null) {
        if (this.eloCalculated) return this.eloDiff;
        if (this.elo === null) return null;
        if (this.isLast()) {
            if (detailedMatchInfo) {
                const eloDelta = getEloDeltaFromStats(detailedMatchInfo, playerId);
                if (eloDelta !== null) {
                    this.eloDiff = eloDelta;
                    this.eloCalculated = true;
                }
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

        this.detailedMatchInfo = detailedMatchInfo;
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
                scoreNode.appendChild(popup);
                scoreNode.style.width = '100px';
                innerNode.children[0].lastChild.style.width = '82px';
                matchHistoryModule.removalNode(popup)
            }
        }
        const eloNode = innerNode?.children[2]?.lastChild?.lastChild?.lastChild
        let eloValue = Number.parseInt(eloNode?.innerText?.replace(/[\s,._]/g, '') ?? '0', 10);
        this.setElo(eloValue);
        this.eloNode = eloNode;
        if (this.settings?.showRWS) {
            if (innerNode.querySelector('[class*="rws-fc"]')) return;
            const rws = getRWSFromStats(detailedMatchInfo, playerId);
            let rwsText = rws?.toFixed(2) ?? '-'
            let rwsCond = rws ? (rws > 5) : false
            let isSlash = !rws
            let rwsNode
            if (this.settings?.coloredStatsRWS) {
                rwsNode = createColoredSpan(rwsText, rwsCond, isSlash)
            } else {
                document.createElement('span').innerText = rwsText
            }
            let krNode = innerNode?.children[6];
            rwsNode.className = krNode.className
            rwsNode.classList.add('rws-fc')
            krNode?.after(rwsNode)
        }

        this.setupStats(innerNode);
    }

    fixHeaderMax(innerNode) {
        if (!this.tableHeader || !innerNode) return;

        const headerInner = this.tableHeader.lastElementChild.lastElementChild.lastElementChild
        if (!headerInner) return;

        const headerChildren = Array.from(headerInner.children);
        const rowChildren = Array.from(innerNode.children);

        const tableWidths = [
            '82px',
            '100px',
            '100px',
            '84.5px',
            '84.5px',
            '84.5px',
            '84.5px',
        ];

        if (this.settings?.showRWS) {
            tableWidths.push('84.5px');
        }

        for (let i = 0; i < tableWidths.length; i++) {
            const width = tableWidths[i];
            const headerChild = headerChildren[i];
            const rowChild = rowChildren[i];

            if (headerChild) {
                headerChild.style.width = width;
                headerChild.style.minWidth = width;
            }
            if (rowChild) {
                rowChild.style.width = width;
                rowChild.style.minWidth = width;
            }
        }
    }

    setupStats(innerNode) {
        const kdaNode = innerNode?.children[3];
        const adrNode = innerNode?.children[4];
        const kdNode = innerNode?.children[5];
        const krNode = innerNode?.children[6];

        if (!kdaNode) return;

        const kdaValues = kdaNode.innerText?.split('/').map(v => parseNumber(v)) || [];
        const [k, d, a] = kdaValues;
        const kd = d ? k / d : 0;

        if (this.settings?.coloredStatsKDA !== false) {
            const newKdaNode = createCompositeCell([
                {text: k, condition: kd >= 1.0},
                {text: "/", condition: null, isSlash: true},
                {text: d, condition: kd >= 1.0},
                {text: "/", condition: null, isSlash: true},
                {text: a, condition: null},
            ]);
            newKdaNode.className = kdaNode.className;
            kdaNode.replaceWith(newKdaNode);
        }

        if (this.settings?.coloredStatsADR !== false) {
            const adr = parseNumber(adrNode?.innerText, true);
            replaceNodeWithColored(adrNode, adr, adr >= 75);
        }

        if (this.settings?.coloredStatsKD !== false) {
            replaceNodeWithColored(kdNode, kd.toFixed(2), kd >= 1);
        }

        if (this.settings?.coloredStatsKR !== false) {
            const kr = parseNumber(krNode?.innerText, true);
            replaceNodeWithColored(krNode, kr, kr >= 0.7);
        }

        this.fixHeaderMax(innerNode);
    }

    async applyEloDiff(playerId) {
        if (this.settings?.eloHistoryCalculation === false) return;

        const eloDiff = await this.calculateEloDiff(playerId, this.detailedMatchInfo);
        if (eloDiff !== null && this.eloNode) {
            let parentElement = this.eloNode.parentElement;
            let eloDidId = `elodif`
            if (parentElement.querySelector(`[class=${eloDidId}]`)) return
            let eloSummaryNode = document.createElement('span');
            eloSummaryNode.classList.add(eloDidId)
            eloSummaryNode.innerText = `${eloDiff > 0 ? '+' : ''}${eloDiff}`;
            parentElement.style.flexDirection = 'row'
            parentElement.style.alignItems = 'baseline'
            parentElement.style.gap = '3px'
            parentElement.style.width = '60px'
            eloSummaryNode.style.color = `${eloDiff > 0 ? green : eloDiff < 0 ? red : white}`
            eloSummaryNode.style.fontSize = 'smaller'
            parentElement.appendChild(eloSummaryNode);
        }
    }

    setupMatchCounterArrow() {
        if (this.settings?.matchCounter === false) return;

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

    let _settings = null

    async function settings() {
        if (_settings) return _settings

        _settings = await getSettings({
            eloHistoryCalculation: true,
            matchCounter: true,
            coloredStatsKDA: true,
            coloredStatsADR: true,
            coloredStatsKD: true,
            coloredStatsKR: true,
            showRWS: false,
            coloredStatsRWS: true
        });

        return _settings
    }

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
        if (tableHeadElement && !tableHeadElement.isConnected) {
            tableHeadElement = null
            tableElement = null
        }

        const nodesArr = filterUnmarkedNodes(nodes);
        const attempts = attempt || 0;

        if (!shouldContinue(nodesArr, attempts, nodes, callback)) return;

        await initializeTableElements(nodesArr);

        const nodeArrays = prepareNodeArrays(nodesArr);

        if (nodeArrays.length === 0) return;

        await processNodeBatches(nodeArrays);
    });

    async function initializeTableElements(nodesArr) {
        if (!tableElement) {
            tableElement = nodesArr[0].parentNode.children;
        }
        if (!tableHeadElement) {
            tableHeadElement = tableElement[0];
            if ((await settings()).showRWS) {
                if (tableHeadElement.querySelector('[class*="rws-fc-header"]')) return
                let headerKR = tableHeadElement.querySelector('div > div > div:nth-child(7)')
                let headerRWS = document.createElement('div')
                headerRWS.className = headerKR.className
                headerRWS.classList.add('rws-fc-header')
                headerRWS.innerText = 'RWS'
                headerKR.after(headerRWS)
            }
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
        const tableNodesArray = Array.from(tableElement).filter(element => element.tagName === 'A');
        for (const nodeArray of nodeArrays) {
            const batch = await createBatchFromNodes(nodeArray, tableNodesArray);
            await loadMatchStatsForBatch(batch);
        }
    }

    async function createBatchFromNodes(nodeArray, tableNodesArray) {
        const batch = [];
        let _settings = await settings();

        for (let node of nodeArray) {
            const index = tableNodesArray.indexOf(node);
            if (index === -1) continue;

            const matchId = extractMatchId(node);

            const matchNode = new MatchNodeByMatchStats(node.children[0], matchId, index, _settings, tableHeadElement);

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

        await Promise.all(batch.map(node =>
            getFromCacheOrFetch(
                node.matchId,
                fetchMatchStatsDetailed,
                (matchId) => fetchV1MatchRoundStats(gameType, matchId, 1, 2)
            ).then(result => node.loadMatchStats(id, result))
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

function getRWSFromStats(detailedMatchInfo, playerId) {
    const player = findPlayerInTeamsById(detailedMatchInfo?.rounds?.[0]?.teams, playerId);
    return player?.player_stats?.["RWS"] ?? null;
}

function getEloFromStats(detailedMatchInfo, playerId) {
    const player = findPlayerInTeamsById(detailedMatchInfo?.rounds?.[0]?.teams, playerId);
    return player?.elo ?? null;
}

function getEloDeltaFromStats(detailedMatchInfo, playerId) {
    const player = findPlayerInTeamsById(detailedMatchInfo?.rounds?.[0]?.teams, playerId);
    return player?.eloDelta ?? null;
}
