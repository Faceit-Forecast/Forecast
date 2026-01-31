/*
 * Copyright (c) 2025 TerraMiner. All Rights Reserved.
 */

const logoSidebarModule = new Module("logoSidebar", async () => {

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

        img.src = getSVGDataURI("src/visual/icons/rawlogo.svg");
        img.alt = "Forecast Logo";
        img.className = "fc-logo-image";
        img.style.background = '#1c1c1c';
        img.style.border = '1px solid rgb(255 106 0 / 42%)';

        gradientWrapper.appendChild(img);
        container.appendChild(gradientWrapper);

        container.addEventListener('click', openExtensionPopup);

        return container;
    };

    logoSidebarModule.doAfterNodeAppear('[class*=styles__TopContent]', (node) => {
        if (document.getElementById("fc-logo-button")) return;

        const container = createLogoContainer(true);
        node.appendChild(container);
    });

    logoSidebarModule.doAfterNodeAppear('[class*=styles__RightSideContainer]', (node) => {
        if (document.getElementById("fc-logo-button")) return;

        const container = createLogoContainer();
        node.prepend(container);
    });
}, async () => {});


function openExtensionPopup() {
    if (toggleExistingPopup()) return;

    const popupURL = getPopupURL();
    const popupContainer = createPopupStructure(popupURL);

    document.body.appendChild(popupContainer);

    const popupFrame = popupContainer.querySelector("#forecast-popup-frame");
    setupFrameMessageHandler(popupFrame);
    positionPopup(popupContainer);
    setupOutsideClickHandler();
}

function toggleExistingPopup() {
    const existingPopup = document.getElementById("forecast-popup-container");
    if (existingPopup) {
        existingPopup.remove();
        return true;
    }
    return false;
}

function getPopupURL() {
    return CLIENT_RUNTIME.getURL("src/visual/popup.html");
}

function createPopupStructure(popupURL) {
    const popupContainer = document.createElement("div");
    popupContainer.id = "forecast-popup-container";

    const popupContent = document.createElement("div");
    popupContent.id = "forecast-popup-content";

    const popupFrame = document.createElement("iframe");
    popupFrame.src = popupURL;
    popupFrame.id = "forecast-popup-frame";
    popupFrame.setAttribute("allow", "clipboard-write");

    popupContent.appendChild(popupFrame);
    popupContainer.appendChild(popupContent);

    return popupContainer;
}

function setupFrameMessageHandler(popupFrame) {
    popupFrame.onload = () => {
        popupFrame.contentWindow.postMessage({ action: 'transparent-bg' }, '*');
    };
}

function positionPopup(popupContainer) {
    const logoButton = document.querySelector(".fc-logo-container");
    if (!logoButton) return;

    const rect = logoButton.getBoundingClientRect();
    const layoutType = detectLayoutType(logoButton);
    const position = calculatePopupPosition(rect, layoutType);

    applyPopupPosition(popupContainer, position);
}

function detectLayoutType(logoButton) {
    if (logoButton.closest('[class*=styles__RightSideContainer]')) {
        return 'rightSidebar';
    }
    if (logoButton.closest('[class*=styles__TopContent]')) {
        return 'topMenu';
    }
    return 'default';
}

function calculatePopupPosition(rect, layoutType) {
    const POPUP_WIDTH = 480;
    const POPUP_HEIGHT = 400;
    const MARGIN = 10;
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;

    const positionCalculators = {
        rightSidebar: () => calculateRightSidebarPosition(rect, POPUP_WIDTH, POPUP_HEIGHT, windowWidth, windowHeight, MARGIN),
        topMenu: () => calculateTopMenuPosition(rect, POPUP_WIDTH, POPUP_HEIGHT, windowWidth, windowHeight, MARGIN),
        default: () => calculateDefaultPosition(rect, POPUP_WIDTH, windowWidth, MARGIN)
    };

    return positionCalculators[layoutType]();
}

function calculateRightSidebarPosition(rect, popupWidth, popupHeight, windowWidth, windowHeight, margin) {
    let top = rect.bottom + margin;
    let left = rect.left;

    if (top + popupHeight > windowHeight) {
        top = Math.max(margin, windowHeight - popupHeight - margin);
    }

    if (left + popupWidth > windowWidth) {
        left = Math.max(margin, windowWidth - popupWidth - margin);
    }

    return { top, left, transformOrigin: 'top left' };
}

function calculateTopMenuPosition(rect, popupWidth, popupHeight, windowWidth, windowHeight, margin) {
    let top = rect.top;
    let left = rect.left - popupWidth - margin;

    if (left < 0) {
        left = rect.right + margin;
        if (left + popupWidth > windowWidth) {
            left = Math.max(margin, rect.left + rect.width / 2 - popupWidth / 2);
        }
    }

    if (top + popupHeight > windowHeight) {
        top = Math.max(margin, windowHeight - popupHeight - margin);
    }

    return { top, left, transformOrigin: 'top right' };
}

function calculateDefaultPosition(rect, popupWidth, windowWidth, margin) {
    let left = rect.right + margin;

    if (rect.right + margin + popupWidth > windowWidth) {
        left = rect.left - popupWidth - margin;
    }

    return { top: rect.top, left, transformOrigin: 'top left' };
}

function applyPopupPosition(popupContainer, position) {
    popupContainer.style.position = "fixed";
    popupContainer.style.top = `${position.top}px`;
    popupContainer.style.left = `${position.left}px`;

    const popupContent = popupContainer.querySelector("#forecast-popup-content");
    if (popupContent && position.transformOrigin) {
        popupContent.style.transformOrigin = position.transformOrigin;
    }
}

function setupOutsideClickHandler() {
    document.addEventListener("click", handleOutsideClick);
}

function handleOutsideClick(e) {
    const popupContainer = document.getElementById("forecast-popup-container");
    const logoButton = document.querySelector(".fc-logo-container");

    const isClickOutside = popupContainer &&
        !popupContainer.contains(e.target) &&
        logoButton &&
        !logoButton.contains(e.target);

    if (isClickOutside) {
        popupContainer.remove();
        document.removeEventListener("click", handleOutsideClick);
    }
}

