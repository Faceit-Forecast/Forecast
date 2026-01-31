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

        if (player.elo) {
            this.setElo(player.elo);
        }

        this.setupStatsToNode(playerId, cachedStats);
    }

    setupStatsToNode(playerId, cachedStats) {
        if (!this.matchStats) return;
        const scoreNode = this.node?.children[1]
        if (scoreNode) {

            scoreNode.parentElement.parentElement.style.overflow = "visible"

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
                scoreNode.querySelector('div').style.gap = 'unset'
                scoreNode.querySelector('div').lastChild.style.justifyContent = "center";
                scoreNode.querySelector('div').appendChild(popup);
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

            let krNode = this.node?.children[6];
            if (krNode) {
                fcrNode.className = krNode.className;
                fcrNode.classList.add('fcr-fc');
                krNode.after(fcrNode);
            }
        }

        this.setupStats();
    }

    setupStats() {
        const kdaNode = this.node?.children[3];
        const adrNode = this.node?.children[4];
        const kdNode = this.node?.children[5];
        const krNode = this.node?.children[6];

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
            kdaNode.replaceWith(kdaWrapperNode);
        }

        if (this.settings?.coloredStatsADR !== false) {
            const adr = parseNumber(adrNode?.innerText, true);
            const adrDisplay = shouldRound ? adr.toFixed(1) : adrNode?.innerText;
            replaceNodeWithColored('td', adrNode, adrDisplay, adr >= 75);
        }

        if (this.settings?.coloredStatsKD !== false) {
            const kdDisplay = shouldRound ? kd.toFixed(1) : kdNode?.innerText;
            replaceNodeWithColored('td', kdNode, kdDisplay, kd >= 1);
        }

        if (this.settings?.coloredStatsKR !== false) {
            const kr = parseNumber(krNode?.innerText, true);
            const krDisplay = shouldRound ? kr.toFixed(1) : krNode?.innerText;
            replaceNodeWithColored('td', krNode, krDisplay, kr >= 0.7);
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
    let selector = `a[href^="${prefix}"][href$="${suffix}"]:not([${tableRowAttribute}]):not(:has([id*=extended-stats-node]))`;
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
        if (!tableElement) {
            tableElement = nodesArr[0].parentNode.parentNode;
        }
        if (!tableHeadElement) {
            tableHeadElement = tableElement.querySelector("thead");
            if ((await settings()).showFCR) {
                if (tableHeadElement.querySelector('[class*="fcr-fc-header"]')) return
                let headerKR = tableHeadElement.querySelector('tr > th:nth-child(7)')
                if (headerKR) {
                    let headerFCR = document.createElement('div')
                    headerFCR.className = headerKR.className
                    headerFCR.classList.add('fcr-fc-header')
                    headerFCR.appendChild(document.createTextNode('FCR'))
                    headerKR.after(headerFCR)
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
        try { // temp fix
            tableNodesArray = Array.from(tableBodyElement.children).filter(element => element.tagName === 'A');
        } catch (e) {
            if (!recursive) {
                await initializeTableElements(nodesArr);
                await processNodeBatches(nodesArr, nodeArrays, true)
            }
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