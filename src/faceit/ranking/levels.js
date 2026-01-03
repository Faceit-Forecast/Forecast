/*
 * Copyright (c) 2025 TerraMiner. All Rights Reserved.
 */

let partySlots = new Map();

class PartySlot {
    nick = null

    constructor(slotNode, id) {
        this.slotNode = slotNode
        this.newIcon = null
        this.isEmpty = true
        this.isShort = null
        this.id = id
    }

    isShortStyle() {
        let isShort = this.slotNode?.firstElementChild?.querySelector(`[class*='ButtonBase__Wrapper']`)?.querySelector(`[class*='PlayerCardListItem__Row-']`)
        return !!isShort
    }

    getNickNode(isShort) {
        let node
        if (isShort) {
            node = this.slotNode?.firstElementChild?.querySelector('[class*=Nickname__Name]')
        } else {
            node = this.slotNode?.firstElementChild?.querySelector('[role=button]')?.children[1]?.children[0]
        }
        if (node?.innerText) this.isEmpty = false
        return node
    }

    getLevelNode(isShort) {
        let node
        if (isShort) {
            node = this.slotNode?.firstElementChild?.querySelector('[class*=SkillIcon__StyledSvg]')
        } else {
            node = this.slotNode?.firstElementChild?.querySelector('[role=button]')?.children[2]
        }
        return node
    }

    isNeedRemove() {
        let currentIsShort = this.isShortStyle()
        if (this.isShort === null) this.isShort = currentIsShort

        let isUpdated = false
        if (this.isShort !== currentIsShort) {
            isUpdated = true
            this.isShort = currentIsShort
        }
        let nickNode = this.getNickNode(currentIsShort)
        return nickNode?.isConnected && !isUpdated
    }

    removeOldIcon() {
        let levelNode = this.getLevelNode(this.isShort);
        if (!levelNode) return
        let icon = levelNode.querySelector('[class*=SkillIcon__StyledSvg]')
        if (!icon) return;
        if (icon.style.display !== "none") {
            icon.style.display = "none"
        }
    }

    async updateIcon() {
        const newNick = this.getNickNode(this.isShort)?.innerText;
        if (!newNick) return;

        const shouldUpdateIcon = newNick !== this.nick || !this.newIcon;
        if (!shouldUpdateIcon) return;

        const iconData = await this.getIconData(newNick);
        if (!iconData) return;

        this.replaceIcon(iconData);
        this.nick = newNick;
    }

    async getIconData(nick) {
        const levelNode = this.getLevelNode(this.isShort);
        if (!levelNode) return null;

        const elo = await this.getElo(nick, levelNode);
        if (!elo) return null;

        const oldIcon = this.getOldIcon(levelNode);
        if (!oldIcon) return null;

        const currentLevel = getLevel(elo, "cs2");
        const newIcon = this.createNewIcon(currentLevel);

        return {levelNode, oldIcon, newIcon};
    }

    async getElo(nick, levelNode) {
        if (this.isShort) {
            return await this.getEloFromStats(nick);
        }
        return this.getEloFromNode(levelNode);
    }

    async getEloFromStats(nick) {
        const playerStatistic = await fetchPlayerStatsByNickName(nick);
        const {gameStats} = getStatistic(playerStatistic);
        if (!gameStats) return null;

        return Number.parseInt(gameStats["faceit_elo"], 10);
    }

    getEloFromNode(levelNode) {
        const textNode = levelNode.querySelector('[class*=styles__EloText]');
        if (!textNode) return null;

        const eloText = textNode.innerText;
        if (!eloText) return null;

        return Number.parseInt(eloText.replace(/[\s,._]/g, ''), 10);
    }

    getOldIcon(levelNode) {
        if (this.isShort) {
            return levelNode;
        }
        return levelNode.querySelector('[class*=SkillIcon__StyledSvg]');
    }

    createNewIcon(level) {
        const newIcon = getLevelIcon(level).firstChild;
        newIcon.classList.add(`party-slot-icon-${this.id}`);
        return newIcon;
    }

    replaceIcon({levelNode, oldIcon, newIcon}) {
        this.removeExistingIcon();

        const iconAlreadyExists = levelNode.querySelector(`[class~=party-slot-icon-${this.id}]`);
        if (iconAlreadyExists) return;

        newLevelsModule.appendToAndHide(newIcon, oldIcon);
        newLevelsModule.removalNode(newIcon);

        this.newIcon = newIcon;
    }

    removeExistingIcon() {
        if (this.newIcon) {
            this.newIcon.remove();
            this.newIcon = null;
            this.isEmpty = true;
        }
    }
}

const newLevelsModule = new Module("eloranking", async () => {
    newLevelsModule.temporaryFaceitBugFix();
    hideWithCSS(`[class*=SkillIcon__StyledSvg]:not([origin-levels]):not([origin-levels] *)`);

    const styleElement = document.createElement("style");
    styleElement.textContent = `span[id*=lvlicon]:has(+ [class*=SkillIcon__StyledSvg]) {margin-inline-end: 0 !important;}`;
    document.head.appendChild(styleElement);

    await newLevelsModule.doAfterNodeAppear('div[class*=Content__StyledContentElement][data-dialog-type=TRAY]:not([marked-as-bug])', async (element) => {
        let uniqueCheck = () => element?.parentElement?.querySelector('[id*=statistic-progress-bar]')
        if (!uniqueCheck()) {
            await newLevelsModule.doAfterAsync(() => element.querySelector('[class*=styles__HeadingWrapper]'), async (result) => {
                if (uniqueCheck()) return
                let nick = result.innerText
                let target = result.parentElement.parentElement.querySelector('[class*=styles__BottomAreaWrapper]')
                let newTable = getHtmlResource("src/visual/tables/elo-progress-bar.html").cloneNode(true)
                setupBrandIcon(newTable, 24, 24)
                newTable.id = "statistic-progress-bar"
                await insertStatsToEloBar(nick, newTable);
                preppendTo(newTable, target, 'progress-bar')
                newLevelsModule.removalNode(newTable);
            })
        }
    })

    let lobby = defineLobby(window.location.href)
    let sessionId = newLevelsModule.sessionId
    let newEloLevelIconId = `session-${sessionId}-new-elo-level-icon`
    let levelIconId = `session-${sessionId}-lvlicon`
    let levelInfoTableId = `session-${sessionId}-level-info-table-container`
    let matchmakingHolderId = `session-${sessionId}-matchmaking-holder`
    let collectionLevelIconId = `session-${sessionId}-collection-level-icon`
    if (lobby.pageType === "matchroom") {
        let gameType = extractGameType("cs2");
        let matchId = extractMatchId();
        let selector = '[class*=Subtitle__Holder]';
        let selector2 = '[role="dialog"] > div[class*=styles__ScrollableContainer] > div[class*=SkillLevel__StatsContainer] > div > span'
        let selector3 = 'div[class*=Scoreboard__Main] > div > div[class*=styles__Flex] > div[class*=styles__MvpWrapper] > div > div[class*=styles__MvpCardHolder] > div > div[class*=Tag__Container] > span'
        let selector4 = '#tooltip-portal > div > div > div > div:nth-child(3)'
        let selector5 = 'div[class*=Scoreboard__Main] > div > div[class*=styles__Section] > div[class*=styles__ScrollWrapper] > table > tbody > tr > td:nth-child(2) > div > div'
        let selector6 = 'div[class*=Scoreboard__Main] > div > div[class*=styles__ScrollWrapper] > table > tbody > tr > td:nth-child(2) > div > div'
        let matchStats;
        let preppendIconOnEloNodeFound = async (cardEloNode) => {
            let eloText = cardEloNode.innerText.replace(/[\s,._]/g, '');
            if (!isNumber(eloText)) return;
            let eloNodeParent = cardEloNode.parentElement;
            if (eloNodeParent.parentElement.querySelector(`[id*=${levelIconId}]`)) return;
            let elo = Number.parseInt(eloText, 10)
            let currentLevel = getLevel(elo, gameType);
            let newIcon = getLevelIcon(currentLevel).firstChild;
            newIcon.id = `${levelIconId}${currentLevel}`;
            preppendTo(newIcon, eloNodeParent);
            newLevelsModule.removalNode(newIcon);
        }
        await newLevelsModule.doAfterAllNodeAppear(selector4, async (node) => {
            if (!matchStats) matchStats = await fetchMatchStats(matchId);

            let avgLevelHandler = (index) => {
                const level = getLevel(matchStats.teams[`faction${index}`].stats.rating, gameType);
                let levelIcon = getLevelIcon(level).firstChild;
                node.querySelector(`div:nth-child(${index})`)?.appendChild(levelIcon);
            }

            avgLevelHandler(1);
            avgLevelHandler(2);
        })
        await newLevelsModule.doAfterAllNodeAppear(selector6, preppendIconOnEloNodeFound);
        await newLevelsModule.doAfterAllNodeAppear(selector5, preppendIconOnEloNodeFound);
        await newLevelsModule.doAfterAllNodeAppear(selector3, preppendIconOnEloNodeFound);
        await newLevelsModule.doAfterAllNodeAppear(selector2, preppendIconOnEloNodeFound);
        await newLevelsModule.doAfterAllNodeAppear(selector, async (eloNode) => {
            if (!isNumber(eloNode.innerText)) return;
            let eloNodeParent = eloNode.parentElement.parentElement;
            if (eloNodeParent.parentElement.querySelector(`[id*=${levelIconId}]`)) return;
            let elo = Number.parseInt(eloNode.innerText, 10);
            let currentLevel = getLevel(elo, gameType);
            let newIcon = getLevelIcon(currentLevel).firstChild;
            newIcon.id = `${levelIconId}${currentLevel}`;
            appendTo(newIcon, eloNodeParent);
            newLevelsModule.removalNode(newIcon);
        });
    } else if (lobby.pageType === "profile") {
        let primarySelector = '[class*=styles__MainSection] > [class*=styles__EloAndLeagueContainer] > div > [class*=styles__Flex] > div'
        let eloTextSelector = `${primarySelector} > div > h5`;
        let badgeHolderSelector = `${primarySelector} > div[class*=BadgeHolder]`
        await newLevelsModule.doAfterNodeAppear(eloTextSelector, async (eloText) => {
            const node = getNthParent(eloText, 2)
            let mainProfileLevelIconId = "main-profile-icon"

            const updateIcon = (mutationsList) => {

                if (mutationsList?.some(m =>
                    [...m.addedNodes, ...m.removedNodes]
                        .some(n => n.nodeType === 1 && n.classList.contains(mainProfileLevelIconId))
                )) return;

                node.querySelector(`[class*='${mainProfileLevelIconId}']`)?.remove()
                let badgeHolder = node.querySelector('[class*=BadgeHolder__Holder]')
                let elo = Number.parseInt(eloText.textContent.replace(/[\s,._]/g, ''), 10);
                let currentLevel = getLevel(elo, lobby.gameType);
                let icon = getLevelIcon(currentLevel);
                const color = getLevelColor(currentLevel);
                let levelSpan = icon.firstChild;
                levelSpan.style.width = "64px";
                levelSpan.style.height = "64px";
                let container = node.parentElement.parentElement;

                container.classList.add('profile-level-container')
                container.style.setProperty('--glow-color', color);
                container.style.setProperty('--glow-color-1', `${color}2E`);
                container.style.setProperty('--glow-color-2', `${color}14`);
                container.style.setProperty('--glow-color-3', `${color}00`);
                container.style.setProperty('--glow-color-4', `${color}0B`);
                container.style.setProperty('--glow-color-5', `${color}05`);
                container.style.setProperty('--glow-color-6', `${color}00`);

                eloText.style.whiteSpace = "nowrap";
                if (badgeHolder) {
                    let div = document.createElement("div");
                    let badgeHodlerParent = badgeHolder.parentElement
                    div.appendChild(icon)
                    div.classList.add(mainProfileLevelIconId);
                    levelSpan.style.width = "52px";
                    levelSpan.style.height = "52px";
                    badgeHolder.style.scale = "0.7";
                    badgeHodlerParent.prepend(div)
                    newLevelsModule.removalNode(div);
                } else {
                    icon.classList.add(mainProfileLevelIconId);
                    node.prepend(icon);
                    newLevelsModule.removalNode(icon);
                }
            }
            updateIcon();
            const observeOptions = {
                childList: true,
                characterData: true,
                subtree: true
            }
            new MutationObserver(updateIcon).observe(node, observeOptions);
        });

        let selector2 = '[class*=styles__MainSection] > div:nth-child(3) > [class*=styles__Col] > a > div > div > div > div:nth-child(3) > div > div:nth-child(2) > span';
        await newLevelsModule.doAfterAllNodeAppear(selector2, async (node) => {
            let levelContainer = node.parentElement.parentElement
            let elo = Number.parseInt(node.textContent.replace(/[\s,._]/g, ''), 10);
            let currentLevel = getLevel(elo, lobby.gameType);
            let icon = getLevelIcon(currentLevel);
            icon.classList.add(newEloLevelIconId);
            if (levelContainer.querySelector(`[class*='${newEloLevelIconId}'`)) return
            levelContainer.prepend(icon)
        });

        let selector3 = '[class*=styles__MainSection] > [class*=styles__Flex] > [class*=styles__Container] > div > [class*=styles__RightPanel] > [class*=styles__RightPanelFooter] > [class*=styles__Col]'
        await newLevelsModule.doAfterAllNodeAppear(selector3, async (node) => {
            let existing = node.querySelector("[unique]")
            existing?.remove()
            let chart = getNthParent(node, 4);
            let chartParent = chart.parentElement;
            if (Array.from(chartParent.children)[2] !== chart) return;
            let nick = extractPlayerNick();
            let playerStatistic = await fetchPlayerStatsByNickName(nick);
            let {gameStats, gameType} = getStatistic(playerStatistic);
            if (!gameStats) return;
            let elo = Number.parseInt(gameStats["faceit_elo"], 10);
            let currentLevel = getLevel(elo, gameType);
            let levelIcon = getLevelIcon(currentLevel);
            levelIcon.setAttribute("unique", "")
            levelIcon.style.scale = "1.25";
            node.appendChild(levelIcon);
        });

        let selector4 = '[class*=styles__TickIconWrapper]'
        await newLevelsModule.doAfterAllNodeAppear(selector4, (node) => {
            if (node.querySelector("[unique]")) return
            let chart = getNthParent(node, 13)
            let chartParent = chart.parentElement
            if (Array.from(chartParent.children)[2] !== chart) return
            let nodeText = node.innerText
            let elo = Number.parseInt(nodeText.replace(/[\s,._]/g, ''), 10);
            let gameType = extractGameType("cs2");
            let currentLevel = getLevel(elo, gameType);
            let levelIcon = getLevelIcon(currentLevel);
            levelIcon.setAttribute("unique", "")
            levelIcon.firstChild.style.width = "24px"
            levelIcon.firstChild.style.height = "24px"
            node.querySelector("span[class*=styles__SkillIconWrapper]")?.remove()
            node.prepend(levelIcon)
        })
    } else if (lobby.pageType === "stats") {
        let selector3 = '[class*=styles__MainSection] > [class*=styles__Flex] > [class*=styles__Container] > div > div > [class*=styles__RightPanel] > [class*=styles__RightPanelFooter] > [class*=styles__Flex] > [class*=styles__Flex] > span'
        await newLevelsModule.doAfterAllNodeAppear(selector3, async (node) => {
            if (node.parentElement.querySelector("[unique]")) return
            let row = getNthParent(node, 2)
            let rowParent = row.parentElement
            let chart = getNthParent(row, 4)
            let chartParent = chart.parentElement
            if (Array.from(chartParent.children)[2] !== chart) return
            let rowArray = Array.from(rowParent.children)
            if (rowArray[0] !== row && rowArray[2] !== row) return

            const updateIcon = () => {
                let eloText = node.innerText
                let elo = Number.parseInt(eloText.replace(/[\s,._]/g, ''), 10);
                let gameType = extractGameType("cs2");
                let currentLevel = getLevel(elo, gameType);
                let levelIcon = getLevelIcon(currentLevel);
                levelIcon.setAttribute("unique", "")
                levelIcon.firstChild.style.width = "24px"
                levelIcon.firstChild.style.height = "24px"

                const existing = node.parentElement.querySelector("[unique]");
                if (existing) existing.remove();

                node.parentElement.prepend(levelIcon)
            }

            updateIcon();

            new MutationObserver(updateIcon).observe(node, {
                childList: true,
                characterData: true,
                subtree: true
            });
        })

        let selector4 = '[class*=styles__TickIconWrapper]'
        await newLevelsModule.doAfterAllNodeAppear(selector4, (node) => {
            if (node.querySelector("[unique]")) return
            let chart = getNthParent(node, 13)
            let chartParent = chart.parentElement
            if (Array.from(chartParent.children)[2] !== chart) return
            let nodeText = node.innerText
            let elo = Number.parseInt(nodeText.replace(/[\s,._]/g, ''), 10);
            let gameType = extractGameType("cs2");
            let currentLevel = getLevel(elo, gameType);
            let levelIcon = getLevelIcon(currentLevel);
            levelIcon.setAttribute("unique", "")
            levelIcon.firstChild.style.width = "24px"
            levelIcon.firstChild.style.height = "24px"
            node.querySelector("span[class*=styles__SkillIconWrapper]")?.remove()
            node.prepend(levelIcon)
        })
    } else if (lobby.pageType === "history") {
        let selector = '[class*=styles__MainSection] > [class*=styles__Flex] > a > div > div > div > div:nth-child(3) > div > div > span[class*=Text]'
        await newLevelsModule.doAfterAllNodeAppear(selector, (node) => {
            let levelContainer = node.parentElement.parentElement
            let elo = Number.parseInt(node.textContent.replace(/[\s,._]/g, ''), 10);
            let currentLevel = getLevel(elo, lobby.gameType);
            let icon = getLevelIcon(currentLevel);
            icon.classList.add(newEloLevelIconId);
            levelContainer.querySelector(`[class*='-new-elo-level-icon']`)?.remove()
            levelContainer.prepend(icon)
        });
    } else if (lobby.pageType === "matchmaking") {
        let selector = '[class*=Matchmaking__PlayHolder]';
        let selectorMidLevel = 'main[class*=Layout__Container] > div[class*=Header__Container] > div:nth-child(2) > div > div > div:nth-child(1) > button > div > div:nth-child(1)'
        let selectorMidLevelLowerThanTen = 'main[class*=Layout__Container] > div[class*=Header__Container] > div:nth-child(2) > div > div > div:nth-child(1) > div > div:nth-child(2) > div:nth-child(1) > div[class*=LevelWidget__IconWrapper]'
        await newLevelsModule.doAfterNodeAppear(selectorMidLevel, (node) => {
            if (node.querySelector("[class*=elowidgeticon]")) return

            let eloText = node.parentElement.querySelector('div:nth-child(2) > div:nth-child(2) > h5').innerText
            let elo = Number.parseInt(eloText.replace(/[\s,._]/g, ''), 10);
            let level = getLevel(elo, "cs2");

            let lvlTextNode = node.parentElement.querySelector('div:nth-child(2) > div:nth-child(1) > span');
            let lvlText = lvlTextNode.innerText;
            let lvlTextOrigin = lvlText.match(/.+ (\d+)/)[1];
            lvlTextNode.innerText = lvlText.replace(lvlTextOrigin, level);

            let levelIcon = getLevelIcon(level);
            let targetPath = levelIcon.querySelector('path[fill="#111111"]');
            if (targetPath) {
                targetPath.setAttribute('fill', '#1F1F22');
            }
            levelIcon.classList.add("elowidgeticon");
            let levelSpan = levelIcon.firstChild;
            levelSpan.style.width = "58px";
            levelSpan.style.height = "58px";
            levelSpan.style.margin = "2px 0px";
            node.appendChild(levelIcon);
        });

        await newLevelsModule.doAfterNodeAppear(selectorMidLevelLowerThanTen, (node) => {
            if (node.querySelector("[class*=elowidgeticon]")) return
            let eloText = node.parentElement.querySelector('h1').innerText
            let elo = Number.parseInt(eloText.replace(/[\s,._]/g, ''), 10);
            let level = getLevel(elo, "cs2");
            let levelIcon = getLevelIcon(level);
            levelIcon.classList.add("elowidgeticon");
            node.appendChild(levelIcon);
        });

        await newLevelsModule.doAfterNodeAppear(selector, handleNodeAppear);

        async function handleNodeAppear(node) {
            if (isMatchmakingHolder(node)) return;

            await waitForTableStructure(node);

            if (isMatchmakingHolder(node)) return;

            const table = getPartyTable(node);
            startPartySlotUpdater(table);
            markAsMatchmakingHolder(node);
        }

        function isMatchmakingHolder(node) {
            return node.id === matchmakingHolderId;
        }

        async function waitForTableStructure(node) {
            await newLevelsModule.doAfterAsync(
                () => checkTableStructure(node),
                () => {
                }
            );
        }

        function checkTableStructure(node) {
            const firstChild = node.firstElementChild;
            if (!firstChild) return false;

            const hasValidChildren = firstChild.children?.length === 2;
            const hasValidSlots = firstChild.children?.[1]?.children?.length === 5;

            return hasValidChildren && hasValidSlots;
        }

        function getPartyTable(node) {
            return Array.from(node.firstElementChild.children)[1];
        }

        function startPartySlotUpdater(table) {
            let isUpdating = false;

            newLevelsModule.every(100, async () => {
                if (isUpdating) return;

                isUpdating = true;
                try {
                    initializePartySlots(table);
                    await updateAllPartySlots();
                } finally {
                    isUpdating = false;
                }
            });
        }

        function initializePartySlots(table) {
            if (partySlots.size >= 5) return;

            Array.from(table.children).forEach((slot, index) => {
                const id = `party-slot-${index}`;

                if (!slot.classList.contains(id)) {
                    slot.classList.add(id);
                    partySlots.set(id, new PartySlot(slot, index));
                }
            });
        }

        async function updateAllPartySlots() {
            for (let j = 0; j < partySlots.size; j++) {
                const id = `party-slot-${j}`;
                const slot = partySlots.get(id);

                await processPartySlot(id, slot);
            }
        }

        async function processPartySlot(id, slot) {
            slot.removeOldIcon();

            if (shouldRemoveSlot(slot)) {
                removePartySlot(id, slot);
                return;
            }

            await slot.updateIcon();
        }

        function shouldRemoveSlot(slot) {
            return !slot.isNeedRemove() && !slot.isEmpty;
        }

        function removePartySlot(id, slot) {
            partySlots.delete(id);
            slot.slotNode.classList.remove(id);

            if (slot.newIcon) {
                slot.newIcon.remove();
            }
        }

        function markAsMatchmakingHolder(node) {
            node.id = matchmakingHolderId;
        }
    } else if (lobby.pageType === "home") {
        let selector = "#canvas-body > [class*=home__Container] > div > [class*=style__SocialGameFeed] > div > [class*=styles__PlayBlock] > [class*=styles__GameSelectorWrapper] > [class*=EloWidget__Wrapper] > [class*=styles__Flex] > h5"
        await newLevelsModule.doAfterNodeAppear(selector, async (node) => {
            let eloText = node.textContent
            let elo = Number.parseInt(eloText.replace(/[\s,._]/g, ''), 10);
            let level = getLevel(elo, "cs2");
            let levelIcon = getLevelIcon(level).firstChild;
            levelIcon.style.width = "24px"
            levelIcon.style.height = "24px"
            node.parentElement.prepend(levelIcon);
        })
    }

    if (lobby.pageType === "profile" || lobby.pageType === "stats" || lobby.pageType === "parties") {
        let selector = '[class*=styles__EloText]';
        await newLevelsModule.doAfterNodeAppear(selector, async (node) => {
            let uniqueCheck = () => node.matches(`[class*=${collectionLevelIconId}]`)
            if (uniqueCheck()) return
            let eloText = node.innerText
            let elo = Number.parseInt(eloText.replace(/[\s,._]/g, ''), 10)
            await newLevelsModule.doAfterAsync(() => node.parentElement.querySelector('svg'), (oldIcon) => {
                if (uniqueCheck()) return
                let currentLevel = getLevel(elo, "cs2");
                let newIcon = getLevelIcon(currentLevel);
                let innerNewIcon = newIcon.firstElementChild;
                newLevelsModule.appendToAndHide(innerNewIcon, oldIcon)
                newLevelsModule.removalNode(innerNewIcon)
                node.classList.add(collectionLevelIconId);
            })
        })

        if (lobby.pageType === "parties") {
            let safeSelectors = ["[class*=styles__RequirementsHolder]", "[class*=styles__BadgesHolder]"]
            safeSelectors.forEach((selector) => {
                newLevelsModule.doAfterNodeAppear(selector, (node) => {
                    if (!node.hasAttribute("origin-levels")) node.setAttribute("origin-levels", '')
                })
            })
        }
    }

    let skillLevelsTableNodeSelector = "body > div.FuseModalPortal > div > div > div[class*=SkillLevelsInfo__ModalContent]"
    await newLevelsModule.doAfterNodeAppear(skillLevelsTableNodeSelector, (node) => {
        let uniqueCheck = () => node?.parentElement?.querySelector('[id*=level-info-table-container]')
        if (!uniqueCheck()) {
            node.parentElement.style.width = "560px";
            let newTable = getHtmlResource("src/visual/tables/skill-levels-info-table.html").cloneNode(true)
            localizeHtmlResource(newTable);
            newTable.id = levelInfoTableId;
            let challengerNode = newTable.querySelector("[class*=challengerinfos-icon]");
            let challengerIcon = getHtmlResource("src/visual/tables/levels/challenger.html").cloneNode(true).firstChild;
            challengerIcon.style.scale = "1.3"
            challengerNode.appendChild(challengerIcon)
            let levelRanges = gameLevelRanges["cs2"];
            for (let level = 1; level <= levelRanges.length; level++) {
                let levelNode = newTable.querySelector(`[class="levelinfos-item lvl-${level}"]`);
                let levelOldIconNode = levelNode.querySelector("[class=levelinfos-icon]");
                let levelIcon = getLevelIcon(level).firstChild;
                levelIcon.style.scale = "1.15";
                const {min, max} = levelRanges[level - 1];
                levelNode.querySelector("[class='levelinfos-name']").innerText = `${t("level", "Level")} ${level}`;
                levelNode.querySelector("[class=levelinfos-range]").innerText = level === 20 ? `(${min}+)` : `(${min} - ${max})`;
                levelOldIconNode.appendChild(levelIcon);
            }
            newLevelsModule.appendToAndHide(newTable, node);
            newLevelsModule.removalNode(newTable);
        }
    })

    doAfterSearchPlayerNodeAppear(handleSearchPlayerNode);
}, () => {
    partySlots.forEach((slot, key) => {
        slot.slotNode.classList.remove(key)
    })
    partySlots.clear();
})

async function handleSearchPlayerNode(node) {
    await newLevelsModule.doAfterAsync(
        () => isNodeReady(node),
        () => processSearchPlayerNode(node)
    );
}

function isNodeReady(node) {
    const nodeEntry = node?.firstChild?.firstChild;
    return !node || (nodeEntry && nodeEntry.childNodes?.length > 2);
}

async function processSearchPlayerNode(node) {
    const nodeEntry = node?.firstChild?.firstChild;
    if (!nodeEntry) return;

    const nick = extractPlayerNickFromNode(nodeEntry);
    const oldIconNode = nodeEntry.childNodes[2];

    await replacePlayerIcon(nick, oldIconNode);
}

function extractPlayerNickFromNode(nodeEntry) {
    let currentNode = nodeEntry.childNodes[1];

    for (let i = 0; i < 7; i++) {
        currentNode = currentNode.firstElementChild;
        if (currentNode.tagName === "SPAN" && i === 0) break;
    }

    return currentNode?.innerText;
}

async function replacePlayerIcon(nick, oldIconNode) {
    await newLevelsModule.doAfterAsync(
        () => findSvgIcon(oldIconNode),
        (oldIcon) => updatePlayerIcon(nick, oldIcon)
    );
}

function findSvgIcon(oldIconNode) {
    const nodes = Array.from(oldIconNode?.firstElementChild?.childNodes || []);
    return nodes.find(node => node.tagName === "svg");
}

async function updatePlayerIcon(nick, oldIcon) {
    const playerStatistic = await fetchPlayerStatsByNickName(nick);
    const {gameStats, gameType} = getStatistic(playerStatistic);

    if (!gameStats) return;

    const elo = Number.parseInt(gameStats["faceit_elo"], 10);
    const currentLevel = getLevel(elo, gameType);
    const icon = getLevelIcon(currentLevel).firstChild;

    newLevelsModule.appendToAndHide(icon, oldIcon);
    newLevelsModule.removalNode(icon);
}

function getStatistic(playerStatistic) {
    let gameType = "cs2"
    let gameStats = playerStatistic["games"][gameType]
    if (!gameStats) {
        gameType = "csgo"
        gameStats = playerStatistic["games"][gameType]
    }
    return {gameStats, gameType}
}

async function insertStatsToEloBar(nick, table) {
    let gameType = "cs2"
    let stats = await fetchPlayerStatsByNickName(nick)
    let gameStats = stats["games"][gameType];
    table.querySelector("a").setAttribute("href", `/${extractLanguage()}/players/${nick}/stats/${gameType}`);

    let elo = Number.parseInt(gameStats["faceit_elo"], 10);
    let currentLevel = getLevel(elo, gameType)
    let progressBarPercentage = getBarProgress(elo, gameType);
    let node = table.querySelector("[class~=skill-current-level]")

    while (node.firstChild) {
        node.firstChild.remove();
    }

    const levelIcon = getLevelIcon(currentLevel);
    levelIcon.firstChild.style.width = "38px"
    levelIcon.firstChild.style.height = "38px"
    if (levelIcon) node.appendChild(levelIcon)

    let levelRanges = gameLevelRanges[gameType];
    let {min, max} = levelRanges[currentLevel - 1]

    let currentEloNode = table.querySelector("a > div > div.details > div.flex-between > div.elo.progress-current-elo > div");
    let eloSvgIconNode = table.querySelector("a > div > div.details > div.flex-between > div.elo.progress-current-elo > svg");
    currentEloNode.innerText = `${elo}`

    table.querySelector("[class~=min-elo-level]").innerText = `${min}`
    table.querySelector("[class~=max-elo-level]").innerText = `${max === Infinity ? '' : max}`

    let isLastLevel = currentLevel === levelRanges.length
    table.querySelector("[class~=elo-to-de-or-up-grade]").innerText = `${min - elo - 1}/+${isLastLevel ? "∞" : max - elo + 1}`

    const progressBar = table.querySelector("a > div > div.details > div:nth-child(2) > div.progress-container.elo-progress-bar-container > div");

    let nextLevelColor = getLevelColor(currentLevel + 1) || getLevelColor(currentLevel);
    let currentLevelColor = getLevelColor(currentLevel);

    currentEloNode.style.setProperty("--glow-color", `${currentLevelColor}B3`);
    eloSvgIconNode.style.setProperty("--glow-color", `${currentLevelColor}B3`);
    progressBar.style.setProperty("--glow-color", `${currentLevelColor}B3`);
    progressBar.style.setProperty('--gradient-start', currentLevelColor);
    progressBar.style.setProperty('--gradient-end', nextLevelColor);

    if (isLastLevel) {
        progressBar.style.width = "100%";
    } else {
        progressBar.style.width = `${progressBarPercentage}%`;
        progressBar.style.backgroundSize = `184px 100%`;
        progressBar.style.backgroundPosition = 'left center';
        progressBar.style.backgroundRepeat = 'no-repeat';
    }
}

function doAfterSearchPlayerNodeAppear(callback) {
    let language = extractLanguage()
    const targetHrefPattern = new RegExp(`^/${language}/players/([a-zA-Z0-9-_]+)$`);
    newLevelsModule.doAfterNodeAppear(`[href*="/${language}/players/"]:not([${newLevelsModule.dataProcessedAttribute}])`, (node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
            let parent = node?.parentElement
            if (!parent) return;
            if (!parent.matches("[class*=styles__PlayersListContainer")) return;
            let doubleParent = parent.parentElement
            if (!doubleParent) return;
            const href = node.getAttribute('href');
            if (href && targetHrefPattern.test(href)) {
                newLevelsModule.processedNode(node);
                callback(node);
            }
        }
    })
}

