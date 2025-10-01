/*
 * Copyright (c) 2025 TerraMiner. All Rights Reserved.
 */

const levelIcons = new Map();
const htmls = new Map();
const images = new Map();

const imageUrls = [
    "src/visual/icons/logo512.png",
    "src/visual/icons/logo256.png",
    "src/visual/icons/logo128.png",
    "src/visual/icons/logo64.png",
];

const htmlUrls = [
    "src/visual/tables/forecaststyles.css",
    "src/visual/profiles/forecastcardsstyles.css",
    "src/visual/tables/level-progress-table.html",
    "src/visual/tables/team.html",
    "src/visual/tables/player.html",
    "src/visual/tables/match-counter-arrow.html",
    "src/visual/tables/matchscore.html",
    "src/visual/tables/elo-progress-bar.html",
    "src/visual/tables/elo-progress-bar-master.html",
    "src/visual/tables/skill-levels-info-table.html",
    "src/visual/tables/levels/challenger.html",
    ...Array.from({length: 20}, (_, i) => `src/visual/tables/levels/level${i + 1}.html`)
];

let isResourcesLoaded = false;

const resourcesModule = new Module("resources", async () => {
    const enabled = await isExtensionEnabled();
    if (!enabled) return;
    if (isResourcesLoaded) return;
    await loadAllHTMLs();
    await loadAllImages();
    await loadLevelIcons();
    setupStyles();
    isResourcesLoaded = true;
});

async function loadAllHTMLs() {
    const promises = [];
    htmlUrls.forEach(url => {
        promises.push(
            getHTMLCodeFromFile(url).then(html => {
                htmls.set(url, html);
            })
        );
    });

    await Promise.all(promises);
}

async function loadAllImages() {
    const promises = [];

    imageUrls.forEach(url => {
        promises.push(
            loadImageAsDataURL(url).then(dataUrl => {
                images.set(url, dataUrl);
            })
        );
    });

    await Promise.all(promises);
}

async function loadImageAsDataURL(filePath) {
    let url;

    if (browserType === FIREFOX) {
        url = browser.runtime.getURL(filePath);
    } else if (browserType === CHROMIUM) {
        url = chrome.runtime.getURL(filePath);
    } else {
        error("Unable to determine runtime environment.");
        return null;
    }

    try {
        const response = await fetch(url);
        if (!response.ok) {
            error(`HTTP error loading image! Status: ${response.status}`);
            return null;
        }

        const blob = await response.blob();
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.readAsDataURL(blob);
        });
    } catch (e) {
        error(`Error loading image ${filePath}: ${e.message}`);
        return null;
    }
}

async function loadLevelIcons() {
    if (levelIcons.size === 20) return;
    for (let level = 1; level <= 20; level++) {
        let lvlResource = getHtmlResource(`src/visual/tables/levels/level${level}.html`);
        levelIcons.set(level, lvlResource);
    }
}

function getHtmlResource(path) {
    return htmls.get(path);
}

function getImageResource(path) {
    return images.get(path);
}

function getLevelIcon(level) {
    return levelIcons.get(level).cloneNode(true);
}

function setupStyles() {
    let css = getHtmlResource("src/visual/tables/forecaststyles.css");
    let cardcss = getHtmlResource("src/visual/profiles/forecastcardsstyles.css");
    let style = document.getElementById("forecast-styles");

    if (!style) {
        style = document.createElement('style');
        style.id = "forecast-styles";
        document.head.appendChild(style);
    }

    style.textContent = '';

    const cssText = document.createTextNode(css.textContent);
    const cssText2 = document.createTextNode(cardcss.textContent);
    style.appendChild(cssText);
    style.appendChild(cssText2);
}

async function getHTMLCodeFromFile(filePath) {
    let url;

    if (browserType === FIREFOX) {
        url = browser.runtime.getURL(filePath);
    } else if (browserType === CHROMIUM) {
        url = chrome.runtime.getURL(filePath);
    } else {
        error("Unable to determine runtime environment.");
        return null;
    }

    const response = await fetch(url);
    if (!response.ok) {
        error(`HTTP error! Status: ${response.status}`);
        return null;
    }

    const htmlContent = await response.text();

    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, 'text/html');
    const tempDiv = document.createElement('div');

    while (doc.body.firstChild) {
        tempDiv.appendChild(doc.body.firstChild);
    }

    return tempDiv;
}