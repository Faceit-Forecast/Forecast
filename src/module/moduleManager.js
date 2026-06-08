/*
 * Copyright (c) 2025 TerraMiner. All Rights Reserved.
 */

let previousUrl = "";
let previousLobby = null;

const lobbyModules = [
    { pages: ['*'], module: integrationsModule, isEnabled: null, isEnabledByDefault: true },
    { pages: ['*'], module: newLevelsModule, isEnabled: null, isEnabledByDefault: true },
    { pages: ['*'], module: logoSidebarModule, isEnabled: null, isEnabledByDefault: true },
    { pages: ['*'], module: profilesModule, isEnabled: null, isEnabledByDefault: true },
    { pages: ['*'], module: matchmakingDataModule, isEnabled: null, isEnabledByDefault: true },
    { pages: ['stats'], module: rankingModule, isEnabled: null, isEnabledByDefault: true },
    { pages: ['matchroom'], module: matchRoomModule, isEnabled: null, isEnabledByDefault: true },
    { pages: ['matchroom'], module: posCatcherModule, isEnabled: null, isEnabledByDefault: true },
    { pages: ['matchroom'], module: customLevelsModule, isEnabled: null, isEnabledByDefault: true },
    { pages: ['history', 'profile'], module: matchHistoryModule, isEnabled: null, isEnabledByDefault: true },
];

async function initExtension() {
    if (!(await isExtensionEnabled())) return
    await loadConfigs();
    await initApiEndpoints();
    resolveAccessToken();
    loadMetricsConfig();
    await normalizeMatchAmount();
    startMetricsReporter();
    startSelectorMetricsReporter();
    startSettingsMetricsReporter();
    initializeMatchHistoryCache();
    initTemplates();
    await resourcesModule.produceOf("load");
    i18nModule.produceOf("load").catch(e => error("i18n background load failed", e));

    await Promise.all(lobbyModules.map(async (lobbyModule) => {
        lobbyModule.isEnabled = await isSettingEnabled(lobbyModule.module.id, lobbyModule.isEnabledByDefault);
    }));

    startPingService();
    syncAuthState();

    setInterval(async function () {
        try {
            let currentUrl = window.location.href;
            if (currentUrl !== previousUrl) {
                previousUrl = currentUrl;
                bumpApiSession();
                const currentLobby = defineLobby(currentUrl);
                await handleModules(currentLobby, previousLobby);
                previousLobby = currentLobby;
            }
        } catch (err) {
            error("Error in URL change handler:", err);
        }
    }, 50);
}

initExtension().catch(err => {
    error("Failed to initialize extension:", err);
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