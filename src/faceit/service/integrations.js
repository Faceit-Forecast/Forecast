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

    const usingFallback = isUsingFallback();

    let processedHtml = sanitizeHtml(bannerData.html);
    let processedTargetUrl = bannerData.targetUrl;

    if (usingFallback) {
        processedHtml = processedHtml.replaceAll('cdn.fforecast.net', 'cdn.fforecast.dev');
        processedHtml = processedHtml.replaceAll('api.fforecast.net', 'api.fforecast.dev');
        if (processedTargetUrl) {
            processedTargetUrl = processedTargetUrl.replaceAll('api.fforecast.net', 'api.fforecast.dev');
        }
    }

    const createBanner = () => {
        let bannerContainer = document.createElement('div');
        bannerContainer.innerHTML = processedHtml;

        if (bannerContainer && processedTargetUrl) {
            bannerContainer.style.cursor = 'pointer';

            bannerContainer.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (isValidUrl(processedTargetUrl)) {
                    window.open(processedTargetUrl, '_blank', 'noopener,noreferrer');
                }
            });
        }

        bannerContainer.classList.add(`forecast-banner`)

        return bannerContainer;
    };

    if (lobbyType === "stats") {
        integrationsModule.doAfterNodeAppear(sel('integrations.statsSlot'), async (node) => {
            const banner = createBanner();
            banner.style.marginTop = "-12px"
            let oldBanner = node.parentElement.querySelector("[class*='forecast-banner']")
            if (oldBanner) {
                oldBanner.remove();
            }
            node.after(banner);
        });
    } else if (lobbyType === "matchroom") {
        integrationsModule.doAfterNodeAppear(sel('integrations.matchroomSlot'), async (node) => {
            const banner = createBanner();
            let oldBanner = node.parentElement.querySelector("[class*='forecast-banner']")
            if (oldBanner) {
                oldBanner.remove()
            }
            node.after(banner);
        });
    }
}, async () => {});