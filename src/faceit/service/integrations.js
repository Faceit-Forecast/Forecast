const integrationsModule = new Module("integrations", async () => {
    const enabled = await isExtensionEnabled() && await isSettingEnabled("integrations", true);
    if (!enabled) return;

    let lobbyType = defineUrlType(window.location.href);
    let bannerData;

    try {
        const language = extractLanguage();
        bannerData = await fetchBannerData(language, lobbyType);
    } catch (e) {
        error(e.message);
    }

    if (!bannerData) return;

    const sanitizedHtml = sanitizeHtml(bannerData.html);

    const createBanner = () => {
        let bannerContainer = document.createElement('div');
        bannerContainer.innerHTML = sanitizedHtml;

        if (bannerContainer && bannerData.targetUrl) {
            bannerContainer.style.cursor = 'pointer';

            bannerContainer.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (isValidUrl(bannerData.targetUrl)) {
                    window.open(bannerData.targetUrl, '_blank', 'noopener,noreferrer');
                }
            });
        }

        return bannerContainer;
    };

    if (lobbyType === "stats") {
        await integrationsModule.doAfterNodeAppear('[class*=forecast-statistic-table]', async (node) => {
            let lvlpc = node.querySelector("[class*=level-progress-container]");
            if (lvlpc) {
                const banner = createBanner();
                appendTo(banner, lvlpc);
            }
        });
    } else if (lobbyType === "matchroom") {
        await integrationsModule.doAfterNodeAppear('[class*=team-table]', async (node) => {
            const banner = createBanner();
            preppendTo(banner, node);
        });
    }
}, async () => {});