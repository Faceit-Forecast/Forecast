/*
 * Copyright (c) 2025 TerraMiner. All Rights Reserved.
 */

const levelIcons = new Map();
const htmls = new Map();
const svgDataURIs = new Map();

const logoSVGUrls = [
    "src/visual/icons/logo.svg",
    "src/visual/icons/rawlogo.svg",
];

const htmlUrls = [
    "src/visual/tables/forecaststyles.css",
    "src/visual/tables/level-progress-table.html",
    "src/visual/tables/team.html",
    "src/visual/tables/player.html",
    "src/visual/tables/match-counter-arrow.html",
    "src/visual/tables/match-history-popup.html",
    "src/visual/tables/elo-progress-bar.html",
    "src/visual/tables/elo-progress-bar-master.html",
    "src/visual/tables/skill-levels-info-table.html",
    "src/visual/tables/levels/challenger.html",
    ...logoSVGUrls,
    ...Array.from({length: 20}, (_, i) => `src/visual/tables/levels/level${i + 1}.html`)
];

let isResourcesLoaded = false;

const resourcesModule = new Module("resources", async () => {
    if (isResourcesLoaded) return;
    await loadAllHTMLs();
    await loadLevelIcons();
    await loadSVGDataURIs();
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

async function loadSVGDataURIs() {
    const promises = logoSVGUrls.map(async url => {
        const svgText = await getSVGText(url);
        const dataURI = `data:image/svg+xml,${encodeURIComponent(svgText)}`;
        svgDataURIs.set(url, dataURI);
    });
    await Promise.all(promises);
}

async function getSVGText(filePath) {
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

    return await response.text();
}

function getSVGDataURI(path) {
    return svgDataURIs.get(path);
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

function getLevelIcon(level) {
    return levelIcons.get(level).cloneNode(true);
}

function setupStyles() {
    let css = getHtmlResource("src/visual/tables/forecaststyles.css");
    let style = document.getElementById("forecast-styles");

    if (!style) {
        style = document.createElement('style');
        style.id = "forecast-styles";
        document.head.appendChild(style);
    }

    style.textContent = '';

    const cssText = document.createTextNode(css.textContent);
    style.appendChild(cssText);
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