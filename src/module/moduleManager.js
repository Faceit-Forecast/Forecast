/*
 * Copyright (c) 2025 TerraMiner. All Rights Reserved.
 */

let previousUrl = "";
let previousLobby = null;

const lobbyModules = [
    { pages: ['*'], module: serviceModule, isEnabled: null, isEnabledByDefault: true },
    { pages: ['*'], module: integrationsModule, isEnabled: null, isEnabledByDefault: true },
    { pages: ['*'], module: newLevelsModule, isEnabled: null, isEnabledByDefault: true },
    { pages: ['*'], module: logoSidebarModule, isEnabled: null, isEnabledByDefault: true },
    { pages: ['stats'], module: rankingModule, isEnabled: null, isEnabledByDefault: true },
    { pages: ['matchroom'], module: matchRoomModule, isEnabled: null, isEnabledByDefault: true },
    { pages: ['matchroom'], module: posCatcherModule, isEnabled: null, isEnabledByDefault: false },
    { pages: ['history', 'profile'], module: matchHistoryModule, isEnabled: null, isEnabledByDefault: true },
];

async function initExtension() {
    if (!(await isExtensionEnabled())) return
    await initializeMatchHistoryCache();
    await loadMatchHistoryCache();
    await resourcesModule.produceOf("load");
    await i18nModule.produceOf("load");

    for (let lobbyModule of lobbyModules) {
        lobbyModule.isEnabled = await isSettingEnabled(lobbyModule.module.id, lobbyModule.isEnabledByDefault);
    }

    setInterval(async function () {
        try {
            let currentUrl = window.location.href;
            if (currentUrl !== previousUrl) {
                previousUrl = currentUrl;
                const currentLobby = defineLobby(currentUrl);
                await handleModules(currentLobby, previousLobby);
                previousLobby = currentLobby;
            }
        } catch (err) {
            error("Error in URL change handler:", err);
        }
    }, 50);
}

initExtension().catch(error => {
    error("Failed to initialize extension:", error);
});

function determineAction(pages, currentLobby, previousLobby) {
    const currentMatch = currentLobby && (pages.includes('*') || pages.includes(currentLobby.pageType));
    const previousMatch = previousLobby && (pages.includes('*') || pages.includes(previousLobby.pageType));

    if (currentMatch && previousMatch) return "reload";
    if (currentMatch) return "load";
    if (previousMatch) return "unload";
    return null;
}

async function handleModules(currentLobby, previousLobby) {
    for (let lobbyModule of lobbyModules) {
        if (!lobbyModule.isEnabled) continue
        const action = determineAction(lobbyModule.pages, currentLobby, previousLobby);
        await lobbyModule.module.produceOf(action)
    }
}