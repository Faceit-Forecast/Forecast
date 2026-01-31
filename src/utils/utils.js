/*
 * Copyright (c) 2025 TerraMiner. All Rights Reserved.
 */

const FIREFOX = "FIREFOX"
const CHROMIUM = "CHROMIUM"

const BROWSER_TYPE = typeof browser === 'undefined' ? CHROMIUM : FIREFOX
const CLIENT_API = BROWSER_TYPE === FIREFOX ? browser : chrome;
const CLIENT_RUNTIME = CLIENT_API.runtime;
const CLIENT_STORAGE_SYNC = CLIENT_API.storage.sync;
const CLIENT_STORAGE = CLIENT_API.storage.local;
const EXTENSION_VERSION = CLIENT_RUNTIME.getManifest().version;

const log_prefix = "%c[%cFORE%cCAST%c]:"

function println(...args) {
    console.log(log_prefix, 'color: white; background-color: black;', 'color: orange; font-weight: bold; background-color: black;', 'color: white; font-weight: bold; background-color: black;', 'color: white; background-color: black;', args.join(" "));
}

function error(message, err) {
    console.error(log_prefix, 'color: white; background-color: black;', 'color: orange; font-weight: bold; background-color: black;', 'color: white; font-weight: bold; background-color: black;', 'color: white; background-color: black;',message || err?.message, err?.stack)
}

function setupBrandIcon(htmlResource, width = 28, height = 28) {
    htmlResource.querySelectorAll(".brand-icon").forEach((node) => {
        let brandLogo = getHtmlResource("src/visual/icons/rawlogo.svg").cloneNode(true)
        node.appendChild(brandLogo)
        node.classList.add("brand-icon-positioned")
        node.style.width = `${width}px`
        node.style.height = `${height}px`
    })
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
    if (!Array.from(sheet.cssRules || []).some(rule => rule.selectorText === selector)) {
        sheet.insertRule(`${selector} { display: none; }`, sheet.cssRules?.length);
    }
}

function appendTo(sourceNode,targetNode) {
    targetNode.after(sourceNode);
}

function appendToAndHide(sourceNode,hiddenNode) {
    appendTo(sourceNode,hiddenNode);
    hideNode(hiddenNode);
}

function preppendTo(sourceNode,targetNode) {
    targetNode.prepend(sourceNode);
}

function preppendToAndHide(sourceNode,hiddenNode) {
    preppendTo(sourceNode,hiddenNode);
    hideNode(hiddenNode);
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

function getNthParent(el, n) {
    while (el && n--) {
        el = el.parentElement;
    }
    return el;
}

async function getSettingValue(name, def) {
    return new Promise((resolve, reject) => {

        CLIENT_STORAGE_SYNC.get([name], (result) => {
            const errorMessage = CLIENT_RUNTIME.lastError;
            if (errorMessage) {
                reject(new Error(errorMessage));
            } else {
                const sliderValue = result[name] === undefined ? def : result[name];
                resolve(sliderValue);
            }
        });
    });
}

async function setSettingValue(name, value) {
    return new Promise((resolve, reject) => {

        CLIENT_STORAGE_SYNC.set({[name]: value}, () => {
            const errorMessage = CLIENT_RUNTIME.lastError;
            if (errorMessage) {
                reject(new Error(errorMessage));
            } else {
                resolve(value);
            }
        });
    });
}

function parseNumber(text, isFloat = false) {
    if (!text) return NaN;
    const cleaned = text.replace(/[^\d.,-]/g, '').replace(',', '.');
    return isFloat ? Number.parseFloat(cleaned) : Number.parseInt(cleaned, 10);
}

function createColoredSpan(tagName, text, condition, isSlash = false) {
    const span = document.createElement(tagName);
    span.style.color = isSlash || text == null ? white : condition == null ? white : (condition ? green : red);
    span.textContent = text ?? "-";
    return span;
}

function createCompositeCell(tagName,items) {
    const container = document.createElement(tagName);
    container.classList.add('fc-composite-cell')
    items.forEach(({text, condition, isSlash}) =>
        container.appendChild(createColoredSpan('div',text, condition, isSlash))
    );
    return container;
}

function replaceNodeWithColored(tagName, node, text, condition) {
    if (!node) return;
    const newNode = createColoredSpan(tagName, text, condition);
    newNode.className = node.className;
    node.replaceWith(newNode);
}

async function isSettingEnabled(name, def) {
    const settings = await CLIENT_STORAGE_SYNC.get([name]);

    if (settings[name] === undefined) {
        await CLIENT_STORAGE_SYNC.set({ [name]: def });
        return def;
    }
    return settings[name];
}

async function getSettings(settingsMap) {
    const keys = Object.keys(settingsMap);
    const storedSettings = await CLIENT_STORAGE_SYNC.get(keys);

    const result = {};
    const toSet = {};

    keys.forEach(key => {
        if (storedSettings[key] === undefined) {
            result[key] = settingsMap[key];
            toSet[key] = settingsMap[key];
        } else {
            result[key] = storedSettings[key];
        }
    });

    if (Object.keys(toSet).length > 0) {
        await CLIENT_STORAGE_SYNC.set(toSet);
    }

    return result;
}

async function isExtensionEnabled() {
    return await isSettingEnabled("isEnabled", true)
}

function setGradientColor(winrateCell, percent) {
    percent = Math.min(Math.max(percent, 0), 100);
    const ratio = percent / 100;
    const colorStops = ["#ff0022", "#fbec1e", "#32d35a"];
    winrateCell.style.color = ratio < 0.5
        ? interpolateColor(colorStops[0], colorStops[1], ratio * 2)
        : interpolateColor(colorStops[1], colorStops[2], (ratio - 0.5) * 2);
}

function interpolateColor(color1, color2, factor) {
    const [r1, g1, b1] = [color1.slice(1, 3), color1.slice(3, 5), color1.slice(5, 7)].map(c => Number.parseInt(c, 16));
    const [r2, g2, b2] = [color2.slice(1, 3), color2.slice(3, 5), color2.slice(5, 7)].map(c => Number.parseInt(c, 16));
    const [r, g, b] = [r1 + (r2 - r1) * factor, g1 + (g2 - g1) * factor, b1 + (b2 - b1) * factor].map(c => Math.round(c).toString(16).padStart(2, '0'));
    return `#${r}${g}${b}`;
}