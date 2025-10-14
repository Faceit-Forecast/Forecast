const integrationsModule = new Module("integrations", async () => {
    const enabled = await isExtensionEnabled() && await isSettingEnabled("integrations", true);
    if (!enabled) return;

    let lobbyType = defineUrlType(window.location.href);

    let bannerHtml
    try {
        bannerHtml = await fetchBannerHtml();
    } catch (e) {
        error(e.message)
    }

    if (!bannerHtml) {
        println("No banners available");
        return;
    }

    let tempHtml = document.createElement('div');
    tempHtml.innerHTML = bannerHtml;

    if (lobbyType === "stats") {
        await integrationsModule.doAfterNodeAppear('[class*=forecast-statistic-table]', async (node) => {
            let lvlpc = node.querySelector("[class*=level-progress-container]");
            if (lvlpc) {
                appendTo(tempHtml, lvlpc);
            }
        });
    } else if (lobbyType === "matchroom") {
        await integrationsModule.doAfterNodeAppear('[class*=team-table]', async (node) => {
            preppendTo(tempHtml, node);
        });
    }
}, async () => {});