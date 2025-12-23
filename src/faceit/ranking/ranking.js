/*
 * Copyright (c) 2025 TerraMiner. All Rights Reserved.
 */

const gameLevelRanges = {
    cs2: [
        {min: 100, max: 500},         // Level 1
        {min: 501, max: 750},       // Level 2
        {min: 751, max: 900},       // Level 3
        {min: 901, max: 1050},      // Level 4
        {min: 1051, max: 1200},     // Level 5
        {min: 1201, max: 1350},     // Level 6
        {min: 1351, max: 1530},     // Level 7
        {min: 1531, max: 1750},     // Level 8
        {min: 1751, max: 2000},     // Level 9
        {min: 2001, max: 2250},     // Level 10
        {min: 2251, max: 2500},     // Level 11
        {min: 2501, max: 2750},     // Level 12
        {min: 2751, max: 3000},     // Level 13
        {min: 3001, max: 3250},     // Level 14
        {min: 3251, max: 3500},     // Level 15
        {min: 3501, max: 3750},     // Level 16
        {min: 3751, max: 4000},     // Level 17
        {min: 4001, max: 4250},     // Level 18
        {min: 4251, max: 4500},     // Level 19
        {min: 4501, max: Infinity}  // Level 20
    ],
    csgo: [
        {min: 100, max: 800},         // Level 1
        {min: 801, max: 950},       // Level 2
        {min: 951, max: 1100},      // Level 3
        {min: 1101, max: 1250},     // Level 4
        {min: 1251, max: 1400},     // Level 5
        {min: 1401, max: 1550},     // Level 6
        {min: 1551, max: 1700},     // Level 7
        {min: 1701, max: 1850},     // Level 8
        {min: 1851, max: 2000},     // Level 9
        {min: 2001, max: 2250},     // Level 10
        {min: 2251, max: 2500},     // Level 11
        {min: 2501, max: 2750},     // Level 12
        {min: 2751, max: 3000},     // Level 13
        {min: 3001, max: 3250},     // Level 14
        {min: 3251, max: 3500},     // Level 15
        {min: 3501, max: 3750},     // Level 16
        {min: 3751, max: 4000},     // Level 17
        {min: 4001, max: 4250},     // Level 18
        {min: 4251, max: 4500},     // Level 19
        {min: 4501, max: Infinity}  // Level 20
    ]
};

function insertAllLevelsToTable(table, currentLevel) {
    levelIcons.forEach((icon, level) => {
        let svgNode = icon.cloneNode(true)
        const node = table.querySelector(`[class*=level-node-${level}]`);
        const span = node.getElementsByTagName("span")[0];
        span.removeAttribute("title");
        let svgSpan = svgNode.getElementsByTagName("span")[0];
        let svgTitle = svgSpan.getAttribute("title");
        svgSpan.removeAttribute("title");
        svgSpan.setAttribute("styled-title", svgTitle)
        rankingModule.appendToAndHide(svgNode.cloneNode(true), span);
        if (level === currentLevel) {
            svgSpan.style.width = "36px";
            svgSpan.style.height = "36px";
            let currentLevelNode = svgNode.cloneNode(true)
            rankingModule.appendToAndHide(currentLevelNode, table.querySelector("[class*=current-level]").getElementsByTagName("span")[0])
        }
    })
}

const rankingModule = new Module("eloranking", async () => {
    rankingModule.temporaryFaceitBugFix();
    doAfterStatisticNodeAppear(async (node) => {
        node.parentElement.querySelector(`[class*=forecast-statistic-table]`)?.remove()
        let newNode = getHtmlResource("src/visual/tables/level-progress-table.html").cloneNode(true)
        localizeHtmlResource(newNode);
        appendTo(newNode, node);
        node.remove();
        newNode.classList.add(`forecast-statistic-table-${rankingModule.sessionId}`)
        setupBrandIcon(newNode, 32, 32);
        await insertAllStatisticToNewTable(newNode);
    })
})

async function insertAllStatisticToNewTable(table) {
    let gameType = extractGameType("cs2")
    let playerNickName = extractPlayerNick();
    let playerStatistic = await fetchPlayerStatsByNickName(playerNickName);
    let gameStats = playerStatistic["games"][gameType];
    let elo = Number.parseInt(gameStats["faceit_elo"], 10);
    let currentLevel = getLevel(elo, gameType);
    let progressBarPercentage = getBarProgress(elo, gameType);

    insertAllLevelsToTable(table, currentLevel);

    let currentEloNode = table.querySelector("[class*=current-elo]")
    currentEloNode.innerText = `${elo}`
    let levelColor = getLevelIcon(currentLevel).querySelector("div > span > svg > g > path:nth-child(3)").getAttribute("fill")
    currentEloNode.style.setProperty("--glow-color", `${levelColor}B3`);
    let levelRanges = gameLevelRanges[gameType];

    table.querySelector("[class*=elo-need-to-reach]").innerText = `${currentLevel === levelRanges.length ? "" : levelRanges[currentLevel].min - elo}`
    table.querySelector("[class*=elo-need-to-reach-text]").innerText = currentLevel === levelRanges.length
        ? t("max_level_reached", "You reached max level!")
        : `${t("points_needed", "Points needed to reach level")} ${currentLevel + 1}`;

    for (let level = 1; level <= levelRanges.length; level++) {
        const levelNode = table.querySelector(`[class*=level-node-${level}]`);
        const progressBar = table.querySelector(`[class*=progress-bar-${level}]`);
        let currentLevelIcon = getLevelIcon(level)
        let prevLevelIcon = levelIcons.get(level - 1)
        if (!prevLevelIcon) prevLevelIcon = currentLevelIcon
        let nextLevelIcon = levelIcons.get(level + 1)
        if (!nextLevelIcon) nextLevelIcon = currentLevelIcon
        let prevLevelColor = prevLevelIcon.querySelector("div > span > svg > g > path:nth-child(3)").getAttribute("fill")
        let currentLevelColor = currentLevelIcon.querySelector("div > span > svg > g > path:nth-child(3)").getAttribute("fill")

        progressBar.style.setProperty('--gradient-start', prevLevelColor);
        progressBar.style.setProperty('--gradient-end', currentLevelColor);

        let levelMinEloTextNode = levelNode.querySelector(`[class~="level-value"]`)
        const {min, max} = levelRanges[level - 1]
        levelNode.setAttribute("range",level === levelRanges.length ? `${min}+` : `${min}-${max}`)
        levelMinEloTextNode.innerText = min
        if (currentLevel > level) {
            levelNode.setAttribute("reached", '')
            progressBar.style.width = "100%"
        } else if (currentLevel === levelRanges.length) {
            levelNode.setAttribute("reached", '')
            progressBar.style.width = "100%";
            document.querySelector("[class*=progress-bar-20]").style.background = "rgb(255, 85, 0)";
        } else if (currentLevel === level && elo >= min && elo <= max) {
            levelNode.setAttribute("reached", '')
            progressBar.style.width = `${progressBarPercentage}%`;
        } else {
            progressBar.style.width = "0%";
        }
    }
}

function getLevel(elo, gameType) {
    const levelRanges = gameLevelRanges[gameType];
    for (let i = 0; i < levelRanges.length; i++) {
        if (elo >= levelRanges[i].min && elo <= levelRanges[i].max) {
            return i + 1;
        }
    }
    return -1;
}

function getBarProgress(elo, gameType) {
    const levelRanges = gameLevelRanges[gameType];
    const currentLevel = getLevel(elo, gameType);

    if (currentLevel === -1) return 0;

    const currentRange = levelRanges[currentLevel - 1];
    const nextLevel = currentLevel < levelRanges.length ? levelRanges[currentLevel] : null;

    if (nextLevel) {
        return ((elo - currentRange.min) / (currentRange.max - currentRange.min)) * 100;
    } else {
        return 100;
    }
}

async function doAfterStatisticNodeAppear(callback) {
    let progressTableSelector = '[class*=styles__MainSection] > div > [class*=styles__Container]:has([class*=styles__SkillLevelsSection])'

    await rankingModule.doAfterNodeAppear(progressTableSelector, async (node) => {
        if (!node.parentElement?.parentElement?.parentElement?.matches || node.parentElement?.parentElement?.parentElement?.matches("[class*=SpotlightSearch__Content]")) return
        if (node.nodeType === Node.ELEMENT_NODE && !node.querySelector(`[class~="forecast-statistic-table-${rankingModule.sessionId}"]`)) {
            let newNode = document.createElement("div")
            appendToAndHide(newNode, node);
            await callback(newNode);
        }
    });
}