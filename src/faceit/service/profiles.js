/*
 * Copyright (c) 2025 TerraMiner. All Rights Reserved.
 */

let FCUserLogo;
let FCUserLogoTooltip;

const profilesModule = new Module("profiles", () => {
    initFCUserLogo();
    initFCUserLogoTooltip();

    let lobby = defineLobby(window.location.href);

    let selectorProfileCard = sel('profiles.profileCard');
    profilesModule.doAfterNodeAppearWhenVisible(selectorProfileCard, async (node) => {
        const nickname = node.textContent;
        await addFCUserLogoIfRegisteredByNick(getNthParent(node, idx('profiles.profileCardParentDepth', 1)), nickname, 24, 24, true);
    });

    let selectorProfileTooltipV2 = sel('profiles.profileTooltipV2');
    profilesModule.doAfterNodeAppearWhenVisible(selectorProfileTooltipV2, async (node) => {
        const nickname = node.textContent;
        const logo = await addFCUserLogoIfRegisteredByNick(getNthParent(node, idx('profiles.profileTooltipV2ParentDepth', 2)), nickname, 20, 20, true);
        if (!logo) return;
        logo.style.display = 'flex'
        logo.style.alignItems = 'center'
        logo.style.height = 'unset'
    });

    let selectorGameMenuHeadersWrapper = sel('profiles.gameMenuHeadersWrapper');
    profilesModule.doAfterNodeAppearWhenVisible(selectorGameMenuHeadersWrapper, async (node) => {
        const existedNodes = node.querySelectorAll(`:scope > div`);
        for (const element of existedNodes) {
            const hrefNode = element.querySelector(':scope > a');
            if (hrefNode.href == window.location.href || hrefNode.href == `${window.location.href}/cs2`) {
                continue;
            }
            createBanMenuHeader(element, node);
            break;
        }
    });

    if (lobby.pageType === "matchroom") {
        let selectorStatsMVP = sel('profiles.statsMVP');
        const statsMVPHandler = (selector) => {
            profilesModule.doAfterNodeAppearWhenVisible(selector, (node) => {
                profilesModule.doAfter(() => node.textContent, async () => {
                    const nickname = node.textContent;
                    await addFCUserLogoIfRegisteredByNick(getNthParent(node, idx('profiles.statsMVPParentDepth', 1)), nickname, 20, 20, true);
                }, 10)
            });
        }
        statsMVPHandler(selectorStatsMVP);

        let selectorMatchPlayer = sel('profiles.matchPlayer');
        const matchId = extractMatchId();
        fetchMatchStats(matchId).then((matchDetails) => {
            const team1 = matchDetails["teams"]["faction1"];
            const team2 = matchDetails["teams"]["faction2"];
            const nicknameToIdMap = new Map(
                [
                    ...team1.roster.map(player => ({
                        playerId: player.player_id,
                        nickname: player.nickname
                    })),
                    ...team2.roster.map(player => ({
                        playerId: player.player_id,
                        nickname: player.nickname
                    }))
                ].map(p => [p.nickname, p.playerId])
            );
            profilesModule.doAfterAllNodeAppearWhenVisible(selectorMatchPlayer, async (node) => {
                const nickname = node.textContent;
                const playerId = nicknameToIdMap.get(nickname);
                await addFCUserLogoIfRegisteredById(getNthParent(node, idx('profiles.matchPlayerParentDepth', 1)), playerId, 16, 16, true);
            });
        });
    }
});

async function addFCUserLogoIfRegisteredByNick(target, nickname, width, height, asChild) {
    if (!nickname) return null;
    let playerId = (await fetchPlayerStatsByNickName(nickname))?.player_id;
    if (!playerId) return null;
    return await addFCUserLogoIfRegisteredById(target,playerId,width,height,asChild)
}

async function addFCUserLogoIfRegisteredById(target, playerId, width, height, asChild) {
    if (!playerId) return null;
    let result = await checkUserRegistered(playerId);
    return result ? addFCUserLogo(target, width, height, asChild) : null;
}

function initFCUserLogo() {
    FCUserLogo = getHtmlResource("src/visual/icons/rawlogo.svg");
    FCUserLogo.classList.add("fc-user-logo");
    let svg = FCUserLogo.querySelector('svg');
    svg.style.width = '100%';
    svg.style.height = '100%';
}

function initFCUserLogoTooltip() {
    FCUserLogoTooltip = document.createElement('div');
    FCUserLogoTooltip.className = 'fc-user-logo-tooltip';
    FCUserLogoTooltip.textContent = t("fcUserLogo.tooltip", "Registered on Forecast");
    document.body.appendChild(FCUserLogoTooltip);
}

function getFCUserLogo(width, height) {
    let node = FCUserLogo.cloneNode(true);
    node.style.width = `${width}px`;
    node.style.height = `${height}px`;

    const updatePosition = () => {
        const rect = node.getBoundingClientRect();
        const tooltipRect = FCUserLogoTooltip.getBoundingClientRect();

        let left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
        let top = rect.top - tooltipRect.height - 8;

        const padding = 10;
        if (left < padding) {
            left = padding;
        }
        if (left + tooltipRect.width > window.innerWidth - padding) {
            left = window.innerWidth - tooltipRect.width - padding;
        }

        if (top < padding) {
            top = rect.bottom + 8;
        }

        FCUserLogoTooltip.style.left = `${left}px`;
        FCUserLogoTooltip.style.top = `${top}px`;
    };

    const showTooltip = () => {
        updatePosition();
        FCUserLogoTooltip.style.opacity = '1';
        FCUserLogoTooltip.style.visibility = 'visible';
    };

    const hideTooltip = () => {
        FCUserLogoTooltip.style.opacity = '0';
        FCUserLogoTooltip.style.visibility = 'hidden';
    };

    node.addEventListener('mouseenter', showTooltip);
    node.addEventListener('mousemove', updatePosition);
    node.addEventListener('mouseleave', hideTooltip);

    return node;
}

function addFCUserLogo(target, width, height, asChild) {
    if (!target) return;

    const container = asChild ? target : target.parentElement;

    if (container?.querySelector(":scope > .fc-user-logo")) return;

    const node = getFCUserLogo(width, height);

    asChild
        ? target.appendChild(node)
        : target.after(node);

    return node
}

function createBanMenuHeader(existedNode, node, nickname) {
    let newBanNode = document.createElement('div');
    newBanNode.classList.add(...existedNode.classList);

    const existedHrefNode = existedNode.querySelector(':scope > a');
    let hrefBanNode = document.createElement('a');
    hrefBanNode.style.display = 'contents';
    hrefBanNode.href = existedHrefNode.href.replace(/(\/players\/[^/]+).*/, '$1/cs2/bans');
    hrefBanNode.classList.add(...existedHrefNode.classList);
    newBanNode.appendChild(hrefBanNode);

    const existedButtonNode = existedHrefNode.querySelector(':scope > button');
    let buttonBanNode = document.createElement('button');
    buttonBanNode.classList.add(...existedButtonNode.classList);
    hrefBanNode.appendChild(buttonBanNode);

    const existedDivNode = existedButtonNode.querySelector(':scope > div');
    let divBanNode = document.createElement('div');
    divBanNode.classList.add(...existedDivNode.classList);
    buttonBanNode.appendChild(divBanNode);

    const existedSpanNode = existedDivNode.querySelector(':scope > span');
    let spanBanNode = document.createElement('span');
    spanBanNode.classList.add(...existedSpanNode.classList);
    spanBanNode.textContent = t("bans_menu_header", "Banned players");
    divBanNode.appendChild(spanBanNode);

    node.appendChild(newBanNode);
}