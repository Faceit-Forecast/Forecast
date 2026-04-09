/*
 * Copyright (c) 2025 TerraMiner. All Rights Reserved.
 */


const MATCHES_PER_LOAD = 30;

const green = 'rgb(61,255,108)';
const red = 'rgb(255, 0, 43)';
const white = 'rgb(255, 255, 255)';

function resolveColumns(row) {
    const col = {};
    const children = row?.children;
    if (!children) return col;

    const numericTds = [];

    for (let i = 0; i < children.length; i++) {
        const td = children[i];
        if (td.classList.contains('fcr-fc') || td.classList.contains('avg-elo-fc')) continue;
        if (td.querySelector(sel('matchhistory.scoreResult'))) {
            col.score = td;
        } else if (td.querySelector(sel('matchhistory.eloValueContainer'))) {
            col.elo = td;
        } else if (td.querySelector('img')) {
            col.map = td;
        } else {
            const text = td.textContent?.trim() || '';
            if (/\d+\s*\/\s*\d+\s*\/\s*\d+/.test(text)) {
                col.kda = td;
            } else if (/^\d+(\.\d+)?$/.test(text.replace(',', ''))) {
                numericTds.push(td);
            }
        }
    }

    if (numericTds.length >= 3) {
        col.adr = numericTds[0];
        col.kd = numericTds[1];
        col.kr = numericTds[2];
    } else if (numericTds.length === 2) {
        col.adr = numericTds[0];
        col.kr = numericTds[1];
    } else if (numericTds.length === 1) {
        col.adr = numericTds[0];
    }

    return col;
}

function resolveHeaderColumns(headerRow, dataRow) {
    const hcol = {};
    if (!headerRow || !dataRow) return hcol;

    const dataCells = Array.from(dataRow.children).filter(
        td => !td.classList.contains('fcr-fc') && !td.classList.contains('avg-elo-fc')
    );
    const headerCells = Array.from(headerRow.children).filter(
        th => !th.classList.contains('avg-elo-fc-header') && !th.classList.contains('fcr-fc-header')
    );

    const numericIndices = [];

    for (let i = 0; i < dataCells.length; i++) {
        const td = dataCells[i];
        if (td.querySelector(sel('matchhistory.eloValueContainer'))) {
            hcol.elo = headerCells[i] ?? null;
        } else {
            const text = td.textContent?.trim() || '';
            if (!/\d+\s*\/\s*\d+\s*\/\s*\d+/.test(text) && !td.querySelector('img') && !td.querySelector(sel('matchhistory.scoreResult')) && /^\d+(\.\d+)?$/.test(text.replace(',', ''))) {
                numericIndices.push(i);
            }
        }
    }

    const lastNumericIdx = numericIndices.length > 0 ? numericIndices[numericIndices.length - 1] : -1;
    if (lastNumericIdx >= 0) {
        hcol.kr = headerCells[lastNumericIdx] ?? null;
    }

    return hcol;
}

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

        this.col = resolveColumns(this.node);

        this.fcrNode = null;
        this.avgEloNode = null;
        this.setupPlaceholders();
        this.setupStats();
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
        const teammatesWithElo = teammates.filter(p => p.elo != null && p.elo > 0);
        const teamAvgElo = teammatesWithElo.length > 0
            ? Math.round(teammatesWithElo.reduce((sum, p) => sum + p.elo, 0) / teammatesWithElo.length)
            : null;
        const enemyPlayersWithElo = enemyTeam ? enemyTeam.players.filter(p => p.elo != null && p.elo > 0) : [];
        const enemyAvgElo = enemyPlayersWithElo.length > 0
            ? Math.round(enemyPlayersWithElo.reduce((sum, p) => sum + p.elo, 0) / enemyPlayersWithElo.length)
            : null;

        if (player.elo) {
            this.setElo(player.elo);
        }

        this.teamAvgElo = teamAvgElo;
        this.enemyAvgElo = enemyAvgElo;

        this.setupStatsToNode(playerId, cachedStats);
    }

    setupPlaceholders() {

        if (this.settings?.showFCR && this.col.kr && !this.node.querySelector('[class*="fcr-fc"]')) {
            this.fcrNode = document.createElement("td");
            this.fcrNode.textContent = '-';
            this.fcrNode.style.color = white;
            this.fcrNode.className = this.col.kr.className;
            this.fcrNode.classList.add('fcr-fc');
            this.col.kr.after(this.fcrNode);
            matchHistoryModule.removalNode(this.fcrNode);
        }

        if (this.settings?.showAVGElo && this.col.elo && !this.node.querySelector('[class*="avg-elo-fc"]')) {
            this.avgEloNode = document.createElement("td");
            this.avgEloNode.classList.add('avg-elo-fc');

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
            teamVal.textContent = '-';

            const enemyVal = document.createElement("span");
            enemyVal.className = "avg-elo-value avg-elo-value-enemy";
            enemyVal.textContent = '-';

            values.appendChild(teamVal);
            values.appendChild(enemyVal);

            cell.appendChild(badges);
            cell.appendChild(values);
            this.avgEloNode.appendChild(cell);

            this.avgEloNode.className += ' ' + this.col.elo.className;
            this.avgEloNode.classList.add('avg-elo-fc');
            this.col.elo.after(this.avgEloNode);
            matchHistoryModule.removalNode(this.avgEloNode);
        }
    }

    setupStatsToNode(playerId, cachedStats) {
        if (!this.matchStats) return;

        this.col = resolveColumns(this.node);

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

        if (this.settings?.showFCR && this.fcrNode) {
            const rating = this.matchStats.Rating;
            const ratingValue = parseFloat(rating);
            this.fcrNode.textContent = rating !== null ? rating + '%' : '-';

            if (this.settings?.coloredStatsFCR !== false && !isNaN(ratingValue)) {
                if (ratingValue >= 20) {
                    this.fcrNode.style.color = green;
                } else if (ratingValue >= 15) {
                    this.fcrNode.style.color = 'rgb(255, 200, 0)';
                } else {
                    this.fcrNode.style.color = red;
                }
            } else {
                this.fcrNode.style.color = white;
            }
        }

        if (this.settings?.showAVGElo && this.avgEloNode) {
            const teamVal = this.avgEloNode.querySelector('.avg-elo-value-team');
            const enemyVal = this.avgEloNode.querySelector('.avg-elo-value-enemy');
            if (teamVal) teamVal.textContent = this.teamAvgElo != null ? formatElo(this.teamAvgElo) : '-';
            if (enemyVal) enemyVal.textContent = this.enemyAvgElo != null ? formatElo(this.enemyAvgElo) : '-';
        }
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
            const composite = createCompositeCell('div', [
                {text: k, condition: kd >= 1.0},
                {text: "/", condition: null, isSlash: true},
                {text: d, condition: kd >= 1.0},
                {text: "/", condition: null, isSlash: true},
                {text: a, condition: null},
            ]);
            kdaNode.textContent = '';
            kdaNode.appendChild(composite);
        }

        if (this.settings?.coloredStatsADR !== false && adrNode) {
            const adr = parseNumber(adrNode.innerText, true);
            const adrDisplay = shouldRound ? adr.toFixed(1) : adrNode.innerText;
            adrNode.textContent = adrDisplay;
            adrNode.style.color = adr >= 75 ? green : red;
        }

        if (this.settings?.coloredStatsKD !== false && kdNode) {
            const kdDisplay = shouldRound ? kd.toFixed(1) : kdNode.innerText;
            kdNode.textContent = kdDisplay;
            kdNode.style.color = kd >= 1 ? green : red;
        }

        if (this.settings?.coloredStatsKR !== false && krNode) {
            const kr = parseNumber(krNode.innerText, true);
            const krDisplay = shouldRound ? kr.toFixed(1) : krNode.innerText;
            krNode.textContent = krDisplay;
            krNode.style.color = kr >= 0.7 ? green : red;
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
    let theadObserver = null;
    let lastHeaderSignature = null;

    const matchChain = new MatchNodeChain();

    let tableRowAttribute = `forecast-matchhistory-row-${matchHistoryModule.sessionId}`;
    let langKey = extractLanguage();
    let gameType = extractGameType("cs2");
    let prefix = `/${langKey}/${gameType}/room/`;
    let suffix = `/scoreboard`;
    let selector = sel('matchhistory.matchRow', { prefix, suffix, attr: tableRowAttribute });
    const matchIdRegex = /\/room\/([^/]+)\/scoreboard/;

    function getHeaderSignature(thead) {
        if (!thead) return '';
        const ths = thead.querySelectorAll('tr > th:not(.avg-elo-fc-header):not(.fcr-fc-header)');
        return Array.from(ths).map(th => th.textContent.trim()).join('|');
    }

    async function insertHeaders(thead) {
        const headerRow = thead.querySelector('tr');
        if (!headerRow) return;

        headerRow.querySelectorAll('.avg-elo-fc-header, .fcr-fc-header').forEach(el => el.remove());

        const firstDataRow = tableElement.querySelector(sel('matchhistory.dataRowInTable') || 'tbody a tr');
        const hcol = resolveHeaderColumns(headerRow, firstDataRow);
        const _settings = await settings();

        if (_settings.showAVGElo && hcol.elo && !headerRow.querySelector('.avg-elo-fc-header')) {
            let headerAVGElo = document.createElement('th')
            headerAVGElo.className = hcol.elo.className
            headerAVGElo.classList.add('avg-elo-fc-header')
            headerAVGElo.appendChild(document.createTextNode('AVG ELO'))
            hcol.elo.after(headerAVGElo)
        }

        if (_settings.showFCR && hcol.kr && !headerRow.querySelector('.fcr-fc-header')) {
            let headerFCR = document.createElement('th')
            headerFCR.className = hcol.kr.className
            headerFCR.classList.add('fcr-fc-header')
            headerFCR.appendChild(document.createTextNode('FCR'))
            hcol.kr.after(headerFCR)
        }
    }

    async function reapplyAllRows() {
        if (!tableElement || !tableElement.isConnected) return;

        if (tableHeadElement) {
            await insertHeaders(tableHeadElement);
        }

        let id = await playerId();

        matchChain.nodes.forEach((matchNode, matchId) => {
            const aLink = tableBodyElement?.querySelector(`a[href*="${matchId}"]`);
            if (!aLink) return;
            const tr = aLink.querySelector('tr');
            if (!tr) return;

            tr.querySelectorAll('.fcr-fc, .avg-elo-fc, [id*=extended-stats-node]').forEach(el => el.remove());

            matchNode.node = tr;
            matchNode.fcrNode = null;
            matchNode.avgEloNode = null;
            matchNode.popup = null;
            matchNode.col = resolveColumns(tr);
            matchNode.setupPlaceholders();
            matchNode.setupStats();

            if (matchNode.cachedStats) {
                matchNode.setupStatsToNode(id, matchNode.cachedStats);
            }
        });
    }

    function setupTheadObserver(thead) {
        if (theadObserver) theadObserver.disconnect();
        lastHeaderSignature = getHeaderSignature(thead);

        theadObserver = new MutationObserver(() => {
            const newSig = getHeaderSignature(thead);
            if (newSig !== lastHeaderSignature) {
                lastHeaderSignature = newSig;
                setTimeout(() => reapplyAllRows(), 50);
            }
        });
        theadObserver.observe(thead, { childList: true, subtree: true });
    }

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

        tableHeadElement = tableElement.querySelector("thead");
        if (tableHeadElement) {
            await insertHeaders(tableHeadElement);
            setupTheadObserver(tableHeadElement);
        }

        if (!tableBodyElement || !tableBodyElement.isConnected) {
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

        await Promise.all(batch.map(async matchNode => {
            const cachedStats = await getFromCacheOrFetch(
                matchNode.matchId,
                null,
                null
            );

            if (cachedStats) {
                matchNode.loadMatchStats(id, cachedStats);
            } else {
                const fetchedStats = await getFromCacheOrFetch(
                    matchNode.matchId,
                    fetchMatchStatsDetailed,
                    fetchV3MatchStats
                );
                if (fetchedStats) {
                    matchNode.loadMatchStats(id, fetchedStats);
                }
            }
        }));
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
