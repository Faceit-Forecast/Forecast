/*
 * Copyright (c) 2025 TerraMiner. All Rights Reserved.
 */

const integrationsModule = new Module("integrations", async () => {
    let lobbyType = defineLobby(window.location.href)?.pageType;
    let bannerData;

    if (lobbyType !== "stats" && lobbyType !== "matchroom") return

    try {
        const language = extractLanguage();
        bannerData = await fetchBannerData(language, lobbyType);
    } catch (e) {
        error(e);
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

        bannerContainer.classList.add(`forecast-banner`)

        return bannerContainer;
    };

    if (lobbyType === "stats") {
        integrationsModule.doAfterNodeAppear('[class*=forecast-statistic-table]', async (node) => {
            let lvlpc = node.querySelector("[class*=level-progress-container]");
            if (lvlpc) {
                const banner = createBanner();
                let oldBanner = lvlpc.querySelector("[class*='forecast-banner']")
                if (oldBanner) {
                    oldBanner.remove()
                }
                appendTo(banner, lvlpc);
            }
        });
    } else if (lobbyType === "matchroom") {
        integrationsModule.doAfterNodeAppear('[class*=team-table]', async (node) => {
            const banner = createBanner();
            let oldBanner = node.querySelector("[class*='forecast-banner']")
            if (oldBanner) {
                oldBanner.remove()
            }
            preppendTo(banner, node);
        });
    }
}, async () => {});