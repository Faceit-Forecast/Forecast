/*
 * Copyright (c) 2025 TerraMiner. All Rights Reserved.
 */

let FCUserLogo;
let FCUserLogoTooltip;

const profilesModule = new Module("profiles", () => {
    initFCUserLogo();
    initFCUserLogoTooltip();

    let lobby = defineLobby(window.location.href);

    let selectorProfileCard = "#canvas-body > div > div > aside > div[class*=styles__CardContent] > div[class*=Draggable__DraggableStyled] > div[class*=styles__Container] > h1";
    profilesModule.doAfterNodeAppearWhenVisible(selectorProfileCard, async (node) => {
        const nickname = node.textContent;
        await addFCUserLogoIfRegisteredByNick(node.parentElement, nickname, 24, 24, true);
    });

    let selectorProfileTooltipV2 = '[role="dialog"][id*="radix"] > div.styles__FixedContainer-sc-71072efc-2.jleWwN > div > a > h5'
    profilesModule.doAfterNodeAppearWhenVisible(selectorProfileTooltipV2, async (node) => {
        const nickname = node.textContent;
        const logo = await addFCUserLogoIfRegisteredByNick(getNthParent(node, 2), nickname, 20, 20, true);
        logo.style.display = 'flex'
        logo.style.alignItems = 'center'
        logo.style.height = 'unset'
    });

    let selectorFriendsList = '[role="dialog"] > div[class*=FriendsMenu__MenuScrollArea] > div[class*=RosterList__FriendsHolder] > div > div > div > div > div[class*=User__UserContainer] > span'
    profilesModule.doAfterNodeAppearWhenVisible(selectorFriendsList, async (node) => {
        const nickname = node.textContent;
        node.style.display = 'flex'
        node.style.alignItems = 'center'
        const logo = await addFCUserLogoIfRegisteredByNick(node, nickname, 20, 20, true);
        logo.style.paddingLeft = '4px'
    });

    if (lobby.pageType === "friends") {
        let selectorFriends = "#canvas-body > div > div > div > div[class*=styles__Flex] > div > div[class*=Friends__FriendsGrid] > a > div > div > div[class*=styles__SlotWrapper] > div > div[class*=styles__Flex] > span[class*=Text-sc]";
        profilesModule.doAfterNodeAppearWhenVisible(selectorFriends, async (node) => {
            const nickname = node.textContent;
            await addFCUserLogoIfRegisteredByNick(node.parentElement, nickname, 24, 24, true);
        });
    }

    if (lobby.pageType === "matchroom") {
        let selectorStatsMVP = '#canvas-body > div > div > div > div > div[class*=Scoreboard__Main] > div > div[class*=styles__Flex] > div[class*=styles__MvpWrapper] > div > div[class*=styles__MvpCardHolder] > div > div[class*=styles__Container] > span[class*=styles__Nickname]'
        profilesModule.doAfterNodeAppearWhenVisible(selectorStatsMVP, (node) => {
            profilesModule.doAfter(() => node.textContent, async () => {
                const nickname = node.textContent;
                await addFCUserLogoIfRegisteredByNick(node.parentElement, nickname, 20, 20, true);
            }, 10)
        });

        let selectorMatchPlayer = '#canvas-body > div > div[class*=styles__MainHolder] > div > div > div[class*=Overview__Grid] > div[class*=Overview__Column] > div > div > div > div > div > div > div > div > div[class*=ListContentPlayer__SlotWrapper] > div > div[class*=styles__NicknameContainer] > div > div'
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
            profilesModule.doAfterNodeAppearWhenVisible(selectorMatchPlayer, async (node) => {
                const nickname = node.textContent;
                const playerId = nicknameToIdMap.get(nickname);
                await addFCUserLogoIfRegisteredById(node.parentElement, playerId, 16, 16, true);
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