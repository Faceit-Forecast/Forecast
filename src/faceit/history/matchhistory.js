/*
 * Copyright (c) 2025 TerraMiner. All Rights Reserved.
 */

const MATCHES_PER_LOAD = 30;
const matchIds = [];
const matchDetailedDatas = new Map();
const loadingMatches = new Set();
const loadedIdAnchors = new Set();
const matchNodesByMatchStats = [];

const weights = {
    killWeight: 1.25,
    assistWeight: 0.48,
    deathWeight: 0.88,
    baseMultiplier: 0.88,
    adrBonus: 0.018,
    killRating: 0.2,
    sniperKills: 0.06,
    pistolKills: 0.04,
    survivalRating: 0.16,
    mvpFactor: 0.26,
    kast: 0.57,
    damage: 0.22,
    multiKill: 0.2,
    clutch: {
        base: 0.32,
        perKill: 0.2,
        win1v1: 0.29,
        win1v2: 0.56,
    },
    entryImpact: {
        firstKills: 0.27,
        entrySuccess: 0.27,
        impact: 0.33,
    },
    headshot: {
        percentage: 0.1,
        bonus: 0.14,
    },
    utility: {
        damage: 0.16,
        flashEfficiency: 0.2,
        successRate: 0.14,
    },
    impactOverall: 0.19,
    finalMultiplier: 0.51,
    normalizationFactor: 0.769,
};

class MatchNodeByMatchStats {
    constructor(node, index) {
        this.node = node;
        this.matchStats = null;
        this.rounds = 0;
        this.score = "";
        this.isWin = false;
        this.index = index
        this.nodeId = `extended-stats-node-${index}`
        this.setupMatchCounterArrow()
    }

    loadMatchStats(playerId) {
        this.matchId = matchIds[this.index]
        let detailedMatchInfo = matchDetailedDatas.get(this.matchId);
        if (!detailedMatchInfo) {
            error(`No detailed match info found for matchId: ${this.matchId}`);
            return;
        }

        const {player: stats, team} = findPlayerInTeamById(detailedMatchInfo.rounds[0].teams, playerId);
        if (!stats) {
            error(`No stats found for playerId: ${playerId} in matchId: ${this.matchId}`);
            return;
        }

        this.matchStats = stats["player_stats"];
        this.rounds = parseInt(detailedMatchInfo.rounds[0].round_stats["Rounds"], 10);
        this.score = detailedMatchInfo.rounds[0].round_stats["Score"].replace(/\s+/g, '');
        this.isWin = team["team_stats"]["Team Win"] === "1";
        this.setupStatsToNode(playerId, detailedMatchInfo);
    }

    setupStatsToNode(playerId, detailedMatchInfo) {
        if (!this.matchStats) return;

        const {
            "Kills": k,
            "Assists": a,
            "Deaths": d,
            "ADR": adr,
            "K/D Ratio": kd,
            "K/R Ratio": kr,
            "Entry Count": entryCount,
            "First Kills": firstKills,
            "Double Kills": doubleKills,
            "Triple Kills": tripleKills,
            "Quadro Kills": quadroKills,
            "Penta Kills": pentaKills,
            "Entry Wins": entryWins,
            "Clutch Kills": clutchKills,
            "1v1Wins": oneVOneWins,
            "1v2Wins": oneVTwoWins,
            "1v1Count": oneVOneCount,
            "1v2Count": oneVTwoCount,
            "Utility Damage": utilityDamage,
            "Headshots": headshots,
            "Headshots %": headshotsPercentage,
            "MVPs": mvps,
            "Flash Successes": flashSuccesses,
            "Enemies Flashed": enemiesFlashed,
            "Flash Count": flashCount,
            "Damage": damage,
            "Sniper Kills": sniperKills,
            "Pistol Kills": pistolKills,
            "Utility Success Rate per Match": utilitySuccessRate,
            "Match Entry Success Rate": matchEntrySuccessRate,
        } = this.matchStats;

        const rounds = this.rounds;
        const kills = parseInt(k, 10);
        const deaths = parseInt(d, 10);
        const assists = parseInt(a, 10);
        const kdRatio = parseFloat(kd) || (kills / Math.max(1, deaths));
        const krValue = parseFloat(kr);
        const adrValue = parseFloat(adr);
        const totalDamage = parseInt(damage, 10) || adrValue * rounds;

        const safeInt = str => parseInt(str, 10) || 0;
        const safeFloat = str => parseFloat(str) || 0;
        const safeRatio = (a, b) => a / Math.max(1, b);
        const bonusIf = (value, threshold, factor) => value > threshold ? (value - threshold) * factor : 0;

        const mvpsValue = safeInt(mvps);
        const firstKillsValue = safeInt(firstKills);
        const entryWinsValue = safeInt(entryWins);
        const entryCountValue = safeInt(entryCount);
        const utilityDamageValue = safeInt(utilityDamage);
        const headshotsInt = safeInt(headshots);
        const hsPercentage = safeFloat(headshotsPercentage) / 100;
        const oneVOneWinsInt = safeInt(oneVOneWins);
        const oneVTwoWinsInt = safeInt(oneVTwoWins);
        const oneVOneCountInt = safeInt(oneVOneCount);
        const oneVTwoCountInt = safeInt(oneVTwoCount);
        const flashSuccessesValue = safeInt(flashSuccesses);
        const enemiesFlashedValue = safeInt(enemiesFlashed);
        const flashCountValue = safeInt(flashCount);

        let baseRating = ((kills * weights.killWeight + assists * weights.assistWeight) /
            Math.max(1, deaths * weights.deathWeight)) * weights.baseMultiplier;
        baseRating *= 1 + bonusIf(kdRatio, 2.0, 0.05);

        const killRating = krValue * weights.killRating + bonusIf(krValue, 1.0, 0.09);
        const sniperKillsValue = safeRatio(safeInt(sniperKills), kills) * weights.sniperKills;
        const pistolKillsValue = safeRatio(safeInt(pistolKills), kills) * weights.pistolKills;
        const survivalRate = 1 - safeRatio(deaths, rounds);
        const survivalRating = survivalRate * weights.survivalRating + bonusIf(survivalRate, 0.7, 0.2);
        const mvpRatio = safeRatio(mvpsValue, rounds);
        const mvpFactor = mvpRatio * weights.mvpFactor + bonusIf(mvpsValue, 3, 0.03);
        const kastEstimate = Math.min(1.0,
            safeRatio(kills + assists, rounds) * 0.65 +
            safeRatio(Math.max(1, rounds) - deaths, rounds) * 0.35);
        const kastRating = kastEstimate * weights.kast;
        const damageRating = safeRatio(totalDamage, rounds * 125) * weights.damage + bonusIf(adrValue, 90, weights.adrBonus);
        const multiKillFactor =
            safeInt(doubleKills) * 1.1 +
            safeInt(tripleKills) * 1.6 +
            safeInt(quadroKills) * 2.2 +
            safeInt(pentaKills) * 3.0;
        const multiKillRating = safeRatio(multiKillFactor, rounds) * weights.multiKill;
        const clutchWinRate1v1 = safeRatio(oneVOneWinsInt, oneVOneCountInt);
        const clutchWinRate1v2 = safeRatio(oneVTwoWinsInt, oneVTwoCountInt);
        const clutchBonus = bonusIf(clutchWinRate1v1, 0.6, 0.15) + bonusIf(clutchWinRate1v2, 0.4, 0.25);
        const clutchRating =
            (clutchWinRate1v1 * weights.clutch.win1v1 + clutchWinRate1v2 * weights.clutch.win1v2) * weights.clutch.base +
            safeRatio(safeInt(clutchKills), rounds) * weights.clutch.perKill +
            clutchBonus;
        const entrySuccessRate = safeFloat(matchEntrySuccessRate) || safeRatio(entryWinsValue, entryCountValue);
        const firstKillBonus = bonusIf(safeRatio(firstKillsValue, rounds), 0.3, 0.2);
        const entryImpact = (
            firstKillsValue * weights.entryImpact.firstKills +
            (entrySuccessRate * entryCountValue) * weights.entryImpact.entrySuccess +
            firstKillBonus
        ) * weights.entryImpact.impact;
        const headShotRatio = safeRatio(headshotsInt, kills);
        const hsBonus = bonusIf(hsPercentage, 0.6, 0.2);
        const hsRating = hsPercentage * weights.headshot.percentage +
            (headShotRatio > 0.5 ? weights.headshot.bonus + bonusIf(headShotRatio, 0.5, 0.15) : 0) +
            hsBonus;
        const flashEfficiency = safeRatio(flashSuccessesValue, flashCountValue) *
            safeRatio(enemiesFlashedValue, rounds * 2) * weights.utility.flashEfficiency;
        const utilitySuccessRateValue = safeFloat(utilitySuccessRate) * weights.utility.successRate;
        const utilityDamageBonus = bonusIf(safeRatio(utilityDamageValue, rounds * 10), 1, 0.1);
        const utilityImpact = safeRatio(utilityDamageValue, rounds * 15) * weights.utility.damage +
            flashEfficiency + utilitySuccessRateValue + utilityDamageBonus;
        const impactRating = (multiKillRating + clutchRating + entryImpact) * weights.impactOverall;
        let rating = (baseRating + killRating + sniperKillsValue + pistolKillsValue +
            survivalRating + mvpFactor + kastRating + damageRating + impactRating +
            hsRating + utilityImpact) * weights.finalMultiplier * weights.normalizationFactor;

        insertStatsIntoNode(this, rating.toFixed(2), k, d, kd, kr, adr, playerId, detailedMatchInfo);
    }

    setupMatchCounterArrow() {
        let matchNumber = (this.index + 1)
        if (matchNumber % 30 !== 0) return
        let arrowId = `arrow-${matchNumber / 30}`
        let borderId = `border-${matchNumber / 30}`

        this.node.style.position = "relative";
        this.node.style.paddingBottom = "1px";

        if (!document.getElementById(borderId)) {
            const borderElement = document.createElement("div");
            borderElement.id = borderId
            borderElement.style.position = "absolute";
            borderElement.style.bottom = "-1px";
            borderElement.style.left = "0";
            borderElement.style.width = "100%";
            borderElement.style.height = "1px";
            borderElement.style.backgroundColor = "rgb(255, 85, 0)";
            borderElement.style.zIndex = "1";
            this.node.appendChild(borderElement);
        }

        if (!document.getElementById(arrowId)) {
            const arrow = getHtmlResource("src/visual/tables/match-counter-arrow.html").cloneNode(true);
            arrow.id = arrowId;
            arrow.style.position = "relative";
            arrow.style.zIndex = "2";

            appendTo(arrow, this.node, 'arrow');

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
    let enabled = (await isExtensionEnabled()) && (await isSettingEnabled("matchhistory", true));
    if (!enabled) return;
    matchHistoryModule.temporaryFaceitBugFix();
    await loadMatchHistoryCache();

    let tableRowAttribute = `forecast-matchhistory-row-${matchHistoryModule.sessionId}`;

    const playerId = (await fetchPlayerStatsByNickName(extractPlayerNick())).player_id;

    let lastIndex = 0
    let tableElement;
    let tableHeadElement;

    let langKey = extractLanguage();
    let gameType = extractGameType();
    let prefix = `/${langKey}/${gameType}/room/`;
    let suffix = `/scoreboard`;
    let selector = `a[href^="${prefix}"][href$="${suffix}"]:not([${tableRowAttribute}]):not(:has([id*='extended-stats-node']))`;

    await matchHistoryModule.doAfterAllNodeAppearPack(selector, async function callback(nodes, attempt){
        let nodesArr = [...nodes].filter((e) => !e.parentNode.parentNode.parentNode.parentNode.parentNode.parentElement.hasAttribute("marked-as-bug"));
        let attempts = attempt ? attempt : 0;
        if (nodesArr.length === 0) {
            if (attempts > 10) return
            setTimeout(async () => await callback(nodes, attempts + 1), 100);
            return
        }
        if (!tableElement) tableElement = nodesArr[0].parentNode.children;
        if (!tableHeadElement) tableHeadElement = tableElement[0];

        let nodeArrays = chunkArray(nodesArr.filter((node) => {
            let flag = tableHeadElement !== node && !node.hasAttribute(tableRowAttribute);
            if (flag) node.setAttribute(tableRowAttribute, '');
            return flag
        }), MATCHES_PER_LOAD);

        if (nodeArrays.length === 0) return

        let tableNodesArray = Array.from(tableElement).filter(element => element.tagName === 'TR');
        for (const nodeArray of nodeArrays) {
            let batch = [];
            let batchIndex = lastIndex === -1 ? 0 : lastIndex
            for (let node of nodeArray) {
                const index = lastIndex === -1 ? (tableNodesArray.indexOf(node) - 1) : lastIndex;
                if (index === -1) continue;
                lastIndex = index + 1;
                batch.push(new MatchNodeByMatchStats(node, index));
            }

            await loadPlayerMatchHistory(playerId, gameType, batchIndex - 1, () => {
                loadDetailedMatches(batchIndex)?.then(() => {
                    Promise.all(batch.map(node => node.loadMatchStats(playerId)))
                })
            });
        }
    });
}, async () => {
    matchNodesByMatchStats.length = 0;
    matchIds.length = 0;
    matchDetailedDatas.clear()
    loadingMatches.clear()
    loadedIdAnchors.clear()
});

function insertStatsIntoNode(matchNode, rating, k, d, kd, kr, adr, playerId, detailedMatchInfo) {
    const fourthNode = matchNode.node?.children[0]?.children[3];
    if (!fourthNode) return;

    let tableTemplate = document.getElementById(matchNode.nodeId);
    let tableNotExist = !tableTemplate;

    if (tableNotExist) {
        tableTemplate = getHtmlResource("src/visual/tables/matchscore.html").cloneNode(true)
        tableTemplate.id = matchNode.nodeId
    }

    insertRow(tableTemplate, matchNode.score, rating, k, d, kd, kr, adr, matchNode.isWin);

    if (!matchNode.popup) {
        matchNode.popup = new MatchroomPopup(tableTemplate)
        matchNode.popup.attachToElement(detailedMatchInfo, playerId)
    }

    if (tableNotExist) {
        matchHistoryModule.appendToAndHide(tableTemplate, fourthNode.querySelector("span"), 'table-template')
        matchHistoryModule.removalNode(tableTemplate)
    }
}

function insertRow(node, score, rating, k, d, kd, kr, adr, isWin) {
    const table = node.querySelector('tbody');
    const tableRow = table.rows.length > 0 ? table.rows[0] : table.insertRow();
    const green = "rgb(61,255,108)", red = "rgb(255, 0, 43)", white = "rgb(255, 255, 255)";

    const createColoredDiv = (text, condition, isSlash = false) => {
        const div = document.createElement("span");
        div.style.color = isSlash || !text ? white : (condition ? green : red);
        if (condition) div.style.fontWeight = "bold";
        div.textContent = text || "-";
        return div;
    };

    const createCompositeCell = (texts) => {
        const container = document.createElement("div");
        texts.forEach(({
                           text,
                           condition,
                           isSlash
                       }) => container.appendChild(createColoredDiv(text, condition, isSlash)));
        return container;
    };

    let [scorePart1, scorePart2] = score.split("/");

    replaceOrInsertCell(tableRow, 0, () => createCompositeCell([
        {text: scorePart1, condition: isWin},
        {text: "/", isSlash: true},
        {text: scorePart2, condition: isWin}
    ]));

    replaceOrInsertCell(tableRow, 1, () => createColoredDiv(isNaN(rating) ? null : rating, rating >= 1.0));

    replaceOrInsertCell(tableRow, 2, () => createCompositeCell([
        {text: k, condition: kd >= 1.0},
        {text: "/", isSlash: true},
        {text: d, condition: kd >= 1.0}
    ]));

    replaceOrInsertCell(tableRow, 3, () => createCompositeCell([
        {text: kd, condition: kd >= 1.0},
        {text: "/", isSlash: true},
        {text: kr, condition: kr >= 0.65}
    ]));

    replaceOrInsertCell(tableRow, 4, () => createColoredDiv(adr, adr >= 75));
}

async function loadAllPlayerMatches(playerId, gameType, fromId, date) {
    loadedIdAnchors.add(fromId);
    const results = await loadPlayerMatches(playerId, gameType, MATCHES_PER_LOAD, date);
    results.forEach(id => matchIds.push(id));
}

async function loadPlayerMatches(playerId, gameType, amount, date) {
    const playerGameDatas = await fetchPlayerInGameStats(playerId, gameType, amount, date);
    return playerGameDatas.items.map(item => item.stats["Match Id"]);
}

function findPlayerInTeamById(teams, playerId) {
    for (const team of teams) {
        const player = team.players.find(player => player.player_id === playerId);
        if (player) return {team, player};
    }
    return {};
}

async function loadPlayerMatchHistory(playerId, gameType, fromId, callback) {
    if (matchIds.length === 0 && loadedIdAnchors.size === 0) {
        await loadAllPlayerMatches(playerId, gameType, fromId, 0).then(callback)
        if (loadedIdAnchors.has(fromId)) return
    }

    matchHistoryModule.doAfter(() => matchIds[fromId], (matchId) => {
        fetchMatchStats(matchId).then(match => {
            let from = match["finished_at"];
            loadAllPlayerMatches(playerId, gameType, from, parseInt(from, 10) * 1000).then(callback)
        })
    }, 50)
}

function loadDetailedMatches(fromId) {
    const toId = Math.min(fromId + MATCHES_PER_LOAD, matchIds.length);
    if (fromId >= toId) return null
    let batch = [];

    for (let i = fromId; i < toId; i++) {
        const matchId = matchIds[i];
        if (loadingMatches.has(matchId) || matchDetailedDatas.get(matchId)) continue;
        batch.push(getFromCacheOrFetch(matchId, fetchMatchStatsDetailed)
            .then(result => matchDetailedDatas.set(matchId, result))
            .finally(() => loadingMatches.delete(matchId)));
        loadingMatches.add(matchId);
    }

    return Promise.all(batch);
}