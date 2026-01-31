/*
 * Copyright (c) 2025 TerraMiner. All Rights Reserved.
 */

const gameLevelRanges = {
    cs2: [
        {min: 100, max: 500},
        {min: 501, max: 750},
        {min: 751, max: 900},
        {min: 901, max: 1050},
        {min: 1051, max: 1200},
        {min: 1201, max: 1350},
        {min: 1351, max: 1530},
        {min: 1531, max: 1750},
        {min: 1751, max: 2000},
        {min: 2001, max: 2250},
        {min: 2251, max: 2500},
        {min: 2501, max: 2750},
        {min: 2751, max: 3000},
        {min: 3001, max: 3250},
        {min: 3251, max: 3500},
        {min: 3501, max: 3750},
        {min: 3751, max: 4000},
        {min: 4001, max: 4250},
        {min: 4251, max: 4500},
        {min: 4501, max: Infinity}
    ],
    csgo: [
        {min: 100, max: 800},
        {min: 801, max: 950},
        {min: 951, max: 1100},
        {min: 1101, max: 1250},
        {min: 1251, max: 1400},
        {min: 1401, max: 1550},
        {min: 1551, max: 1700},
        {min: 1701, max: 1850},
        {min: 1851, max: 2000},
        {min: 2001, max: 2250},
        {min: 2251, max: 2500},
        {min: 2501, max: 2750},
        {min: 2751, max: 3000},
        {min: 3001, max: 3250},
        {min: 3251, max: 3500},
        {min: 3501, max: 3750},
        {min: 3751, max: 4000},
        {min: 4001, max: 4250},
        {min: 4251, max: 4500},
        {min: 4501, max: Infinity}
    ]
};

function getLevelColor(level) {
    return LEVEL_COLORS[level] || '#FFFFFF';
}

function getEloColor(elo, gameType = 'cs2') {
    const level = getLevel(elo, gameType);
    return getLevelColor(level);
}

function insertAllLevelsToTable(table, currentLevel) {
    LEVEL_TEMPLATES.forEach((icon, level) => {
        let svgNode = icon.cloneNode(true)
        const node = table.querySelector(`[class*=level-node-${level}]`);
        const span = node.getElementsByTagName("span")[0];
        span.removeAttribute("title");
        let svgSpan = svgNode.getElementsByTagName("span")[0];
        let svgTitle = svgSpan.getAttribute("title");
        svgSpan.removeAttribute("title");
        svgSpan.setAttribute("styled-title", svgTitle)
        span.appendChild(svgNode.cloneNode(true).firstChild);
        if (level === currentLevel) {
            svgSpan.style.width = "36px";
            svgSpan.style.height = "36px";
            table.querySelector("[class*=current-level]").getElementsByTagName("span")[0].appendChild(svgNode.cloneNode(true).firstChild);
        }
    })
}

const rankingModule = new Module("eloranking", async () => {
    rankingModule.temporaryFaceitBugFix();
    hideWithCSS(`[class*=styles__MainSection] > div > [class*=styles__Container]:has([class*=styles__SkillLevelsSection]):has(+ [class*=forecast-statistic-table])`);
    doAfterStatisticNodeAppear(async (node) => {
        node.parentElement.querySelector(`[class*=forecast-statistic-table]`)?.remove()
        let newNode = LEVEL_PROGRESS_TABLE_TEMPLATE.cloneNode(true)
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
    let levelColor = getLevelColor(currentLevel);
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
        let prevLevelIcon = LEVEL_TEMPLATES.get(level - 1)
        if (!prevLevelIcon) prevLevelIcon = currentLevelIcon
        let nextLevelIcon = LEVEL_TEMPLATES.get(level + 1)
        if (!nextLevelIcon) nextLevelIcon = currentLevelIcon
        let prevLevelColor = getLevelColor(level - 1) || getLevelColor(level);
        let currentLevelColor = getLevelColor(level);

        progressBar.style.setProperty('--gradient-start', prevLevelColor);
        progressBar.style.setProperty('--gradient-end', currentLevelColor);

        let levelMinEloTextNode = levelNode.querySelector(`[class~="level-value"]`)
        const {min, max} = levelRanges[level - 1]
        levelNode.setAttribute("range", level === levelRanges.length ? `${min}+` : `${min}-${max}`)
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

    rankingModule.doAfterNodeAppear(progressTableSelector, async (node) => {
        if (!node.parentElement?.parentElement?.parentElement?.matches || node.parentElement?.parentElement?.parentElement?.matches("[class*=SpotlightSearch__Content]")) return
        if (node.nodeType === Node.ELEMENT_NODE && !node.querySelector(`[class~="forecast-statistic-table-${rankingModule.sessionId}"]`)) {
            let newNode = document.createElement("div")
            appendTo(newNode, node);
            await callback(newNode);
        }
    });
}