/*
 * Copyright (c) 2025 TerraMiner. All Rights Reserved.
 */

const prefix = "[FORECAST]"
const FIREFOX = "FIREFOX"
const CHROMIUM = "CHROMIUM"

const browserType = typeof browser !== 'undefined' ? FIREFOX : CHROMIUM

function println(...args) {
    console.log('%c[%cFORE%cCAST%c]:', 'color: white; background-color: black;', 'color: orange; font-weight: bold; background-color: black;', 'color: white; font-weight: bold; background-color: black;', 'color: white; background-color: black;', args.join(" "));
}

function error(...args) {
    console.error(prefix + " " + args.join(" "));
}

function hideNode(node) {
    node.style.display = 'none';
    node.setAttribute("hided", "true");
}

function hideWithCSS(selector) {
    let style = document.getElementById("hideStyleElement");
    if (!style) {
        style = document.createElement('style');
        style.id = "hideStyleElement";
        document.head.appendChild(style);
    }
    const sheet = style.sheet;
    if (!Array.from(sheet.cssRules || []).find(rule => rule.selectorText === selector)) {
        sheet.insertRule(`${selector} { display: none; }`, sheet.cssRules.length);
    }
}

function appendTo(sourceNode,targetNode) {
    targetNode.insertAdjacentElement('afterend', sourceNode);
}

function appendToAndHide(sourceNode,hiddenNode) {
    appendTo(sourceNode,hiddenNode);
    hideNode(hiddenNode);
}

function preppendTo(sourceNode,targetNode) {
    targetNode.insertAdjacentElement('afterbegin', sourceNode);
}

function preppendToAndHide(sourceNode,hiddenNode) {
    preppendTo(sourceNode,hiddenNode);
    hideNode(hiddenNode);
}

function replaceOrInsertCell(row, index, contentCreator) {
    let cell = row.cells[index];

    if (!cell) {
        cell = row.insertCell(index);
    } else {
        cell.innerHTML = '';
    }

    cell.appendChild(contentCreator());
}

function isNumber(text) {
    return /^-?\d+(\.\d+)?$/.test(text);
}

function chunkArray(arr, size) {
    const result = [];
    for (let i = 0; i < arr.length; i += size) {
        result.push(arr.slice(i, i + size));
    }
    return result;
}

async function getSettingValue(name, def) {
    return new Promise((resolve, reject) => {
        const storageAPI = browserType === FIREFOX ? browser.storage.sync : chrome.storage.sync;

        storageAPI.get([name], (result) => {
            const errorMessage = browserType === FIREFOX ? browser.runtime.lastError : chrome.runtime.lastError;
            if (errorMessage) {
                reject(new Error(errorMessage));
            } else {
                const sliderValue = result[name] !== undefined ? result[name] : def;
                resolve(sliderValue);
            }
        });
    });
}

async function isSettingEnabled(name, def) {
    const storageAPI = browserType === FIREFOX ? browser.storage.sync : chrome.storage.sync;
    const settings = await storageAPI.get([name]);

    if (settings[name] === undefined) {
        await storageAPI.set({ [name]: def });
        return def;
    }
    return settings[name];
}

async function isExtensionEnabled() {
    return await isSettingEnabled("isEnabled", true)
}

function setGradientColor(winrateCell, percent) {
    percent = Math.min(Math.max(percent, 0), 100);
    const ratio = percent / 100;
    const colorStops = ["#ff0022", "#fbec1e", "#32d35a"];
    const gradientColor = ratio < 0.5
        ? interpolateColor(colorStops[0], colorStops[1], ratio * 2)
        : interpolateColor(colorStops[1], colorStops[2], (ratio - 0.5) * 2);
    winrateCell.style.color = gradientColor;
}

function interpolateColor(color1, color2, factor) {
    const [r1, g1, b1] = [color1.slice(1, 3), color1.slice(3, 5), color1.slice(5, 7)].map(c => parseInt(c, 16));
    const [r2, g2, b2] = [color2.slice(1, 3), color2.slice(3, 5), color2.slice(5, 7)].map(c => parseInt(c, 16));
    const [r, g, b] = [r1 + (r2 - r1) * factor, g1 + (g2 - g1) * factor, b1 + (b2 - b1) * factor].map(c => Math.round(c).toString(16).padStart(2, '0'));
    return `#${r}${g}${b}`;
}