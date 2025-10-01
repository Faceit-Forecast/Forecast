/*
 * Copyright (c) 2025 TerraMiner. All Rights Reserved.
 */

const logoSidebarModule = new Module("logoSidebar", async () => {
    let enabled = await isExtensionEnabled();
    if (!enabled) return;

    const logoConfig = {
        borderWidth: '2px',
        borderBlur: '4px',
        borderOpacity: '0.8',
        animationSpeed: '4s',
        brightness: '1.2'
    };

    const createLogoContainer = (isTopContent = false) => {
        const container = document.createElement("div");
        container.id = "fc-logo-button";
        container.className = "fc-logo-container";
        container.style.cursor = "pointer";
        container.title = "FORECAST";

        if (isTopContent) {
            container.style.margin = "0px 10px 10px 10px";
        }

        const gradientWrapper = document.createElement("div");
        gradientWrapper.className = "fc-logo-gradient";

        Object.entries(logoConfig).forEach(([key, value]) => {
            const cssVar = `--${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
            gradientWrapper.style.setProperty(cssVar, value);
        });

        const img = document.createElement("img");
        img.src = getImageResource("src/visual/icons/logo64.png").toString();
        img.alt = "Forecast Logo";
        img.className = "fc-logo-image";

        gradientWrapper.appendChild(img);
        container.appendChild(gradientWrapper);

        container.addEventListener('click', openExtensionPopup);

        return container;
    };

    await logoSidebarModule.doAfterNodeAppear('[class*="styles__TopContent"]', (node) => {
        if (document.getElementById("fc-logo-button")) return;

        const container = createLogoContainer(true);
        node.appendChild(container);

        addLogoStyles();
    });

    await logoSidebarModule.doAfterNodeAppear('[class*="styles__RightSideContainer"]', (node) => {
        if (document.getElementById("fc-logo-button")) return;

        const container = createLogoContainer();
        node.prepend(container);

        addLogoStyles();
    });
}, async () => {});


function openExtensionPopup() {
    const existingPopup = document.getElementById("forecast-popup-container");
    if (existingPopup) {
        existingPopup.remove();
        return;
    }

    const popupURL = browserType === FIREFOX
        ? browser.runtime.getURL("src/visual/popup.html")
        : chrome.runtime.getURL("src/visual/popup.html");

    const popupContainer = document.createElement("div");
    popupContainer.id = "forecast-popup-container";

    const popupContent = document.createElement("div");
    popupContent.id = "forecast-popup-content";

    const popupFrame = document.createElement("iframe");
    popupFrame.src = popupURL;
    popupFrame.id = "forecast-popup-frame";
    popupFrame.setAttribute("allow","clipboard-write")

    popupContent.appendChild(popupFrame);
    popupContainer.appendChild(popupContent);
    document.body.appendChild(popupContainer);

    popupFrame.onload = () => {
        popupFrame.contentWindow.postMessage({ action: 'setBackgroundColor', color: 'transparent' }, '*');
    };

    const logoButton = document.querySelector(".fc-logo-container");
    if (logoButton) {
        const rect = logoButton.getBoundingClientRect();
        const isTopMenu = logoButton.closest('[class*="styles__TopContent"]') !== null;
        const isRightSidebar = logoButton.closest('[class*="styles__RightSideContainer"]') !== null;
        const popupWidth = 480;
        const popupHeight = 400;
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;

        popupContainer.style.position = "fixed";

        if (isRightSidebar) {
            let top = rect.bottom + 10;
            let left = rect.left;

            if (top + popupHeight > windowHeight) {
                top = Math.max(10, windowHeight - popupHeight - 10);
            }

            if (left + popupWidth > windowWidth) {
                left = Math.max(10, windowWidth - popupWidth - 10);
            }

            popupContainer.style.top = `${top}px`;
            popupContainer.style.left = `${left}px`;
            popupContent.style.transformOrigin = "top left";
        } else if (isTopMenu) {
            let top = rect.top;
            let left = rect.left - popupWidth - 10;

            if (left < 0) {
                left = rect.right + 10;
                if (left + popupWidth > windowWidth) {
                    left = Math.max(10, rect.left + rect.width/2 - popupWidth/2);
                }
            }

            if (top + popupHeight > windowHeight) {
                top = Math.max(10, windowHeight - popupHeight - 10);
            }

            popupContainer.style.top = `${top}px`;
            popupContainer.style.left = `${left}px`;
            popupContent.style.transformOrigin = "top right";
        } else {
            popupContainer.style.top = `${rect.top}px`;
            popupContainer.style.left = `${rect.right + 10}px`;

            if (rect.right + 10 + popupWidth > windowWidth) {
                popupContainer.style.left = `${rect.left - popupWidth - 10}px`;
            }
        }
    }

    addPopupStyles();

    document.addEventListener("click", function closePopupOutside(e) {
        const popupContainer = document.getElementById("forecast-popup-container");
        const logoButton = document.querySelector(".fc-logo-container");

        if (popupContainer &&
            !popupContainer.contains(e.target) &&
            logoButton && !logoButton.contains(e.target)) {
            popupContainer.remove();
            document.removeEventListener("click", closePopupOutside);
        }
    });
}

function addPopupStyles() {
    if (document.getElementById('fc-popup-styles')) return;

    const style = document.createElement('style');
    style.id = 'fc-popup-styles';
    style.textContent = `
        #forecast-popup-container {
            position: fixed;
            z-index: 9999;
            filter: drop-shadow(0 4px 20px rgba(0,0,0,0.25));
        }
        
        #forecast-popup-content {
            position: relative;
            width: 480px;
            height: 400px;
            border-radius: 12px;
            overflow: hidden;
            background-color: transparent;
            animation: fc-popup-appear 0.2s ease forwards;
        }
        
        @keyframes fc-popup-appear {
            from {
                opacity: 0;
                transform: scale(0.95);
            }
            to {
                opacity: 1;
                transform: scale(1);
            }
        }
        
        #forecast-popup-frame {
            border: none;
            width: 100%;
            height: 100%;
        }
    `;

    document.head.appendChild(style);
}

function addLogoStyles() {
    if (document.getElementById('fc-logo-styles')) return;
    const style = document.createElement('style');
    style.id = 'fc-logo-styles';
    style.textContent = `
        @property --angle {
            syntax: "<angle>";
            initial-value: 0deg;
            inherits: false;
        }
        
        .fc-logo-container {
            position: relative;
            width: 44px;
            height: 44px;
        }
        
        .fc-logo-gradient {
            position: relative;
            width: 100%;
            height: 100%;
            border-radius: 8px;
            display: flex;
            justify-content: center;
            align-items: center;
        }
        
        .fc-logo-image {
            width: 44px;
            height: 44px;
            border-radius: 8px;
            position: relative;
            z-index: 1;
            transition: filter 0.2s ease;
            image-rendering: -webkit-optimize-contrast;
            image-rendering: crisp-edges;
            -ms-interpolation-mode: bicubic;
            filter: brightness(1) contrast(1.05);
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        
        .fc-logo-container:hover .fc-logo-image {
            filter: brightness(var(--hover-brightness, 1.2)) contrast(1.05);
        }
        
        .fc-logo-gradient::before,
        .fc-logo-gradient::after {
            content: '';
            position: absolute;
            height: 40px;
            width: 40px;
            border-radius: 8px;
            z-index: 0;
            background-image: conic-gradient(from var(--angle), #ff4500, #ff8c00, #ffcc00, #ff4500);
            animation: var(--animation-speed, 4s) logo-spin linear infinite;
        }
        
        .fc-logo-gradient::before {
            filter: blur(var(--border-blur, 4px));
            opacity: var(--border-opacity, 0.8);
        }
        
        @keyframes logo-spin {
            from { --angle: 0deg; }
            to { --angle: 360deg; }
        }
        
        #forecast-popup-container {
            box-shadow: 0 4px 20px rgba(0,0,0,0.25);
            border-radius: 8px;
            overflow: hidden;
        }
    `;
    document.head.appendChild(style);
}