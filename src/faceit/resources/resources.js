/*
 * Copyright (c) 2025 TerraMiner. All Rights Reserved.
 */
const parser = new DOMParser();
const htmls = new Map();
const svgDataURIs = new Map();

const logoSVGUrls = [
    "src/visual/icons/logo.svg",
    "src/visual/icons/rawlogo.svg"
];

const htmlUrls = [
    ...logoSVGUrls,
];

let isResourcesLoaded = false;

const resourcesModule = new Module("resources", async () => {
    if (isResourcesLoaded) return;
    await loadAllHTMLs();
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
    let url = CLIENT_RUNTIME.getURL(filePath);

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

function getHtmlResource(path) {
    return htmls.get(path);
}

function getLevelIcon(level, width = 32, height = 32) {
    let icon = LEVEL_TEMPLATES.get(level).cloneNode(true)
    const span = icon.querySelector('span');
    span.style.width = `${width}px`
    span.style.height = `${height}px`
    return icon;
}

function setupStyles() {
    let css = FORECAST_STYLES_TEMPLATE;
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
    let url = CLIENT_RUNTIME.getURL(filePath);

    const response = await fetch(url);
    if (!response.ok) {
        error(`HTTP error! Status: ${response.status}`);
        return null;
    }

    const htmlContent = await response.text();

    const doc = parser.parseFromString(htmlContent, 'text/html');
    const tempDiv = document.createElement('div');

    while (doc.body.firstChild) {
        tempDiv.appendChild(doc.body.firstChild);
    }

    return tempDiv;
}