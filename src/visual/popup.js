/*
 * Copyright (c) 2025 TerraMiner. All Rights Reserved.
 */

const isTest = false;

const FIREFOX = "FIREFOX"
const CHROMIUM = "CHROMIUM"

const BROWSER_TYPE = typeof browser === 'undefined' ? CHROMIUM : FIREFOX
const CLIENT_API = BROWSER_TYPE === FIREFOX ? browser : chrome;
const CLIENT_RUNTIME = CLIENT_API.runtime;
const CLIENT_STORAGE = CLIENT_API.storage.sync;

const CS2_MAPS = ['de_dust2', 'de_mirage', 'de_nuke', 'de_ancient', 'de_train', 'de_inferno', 'de_overpass'];

const PATCH_NOTES_URL = 'https://raw.githubusercontent.com/TerraMiner/Forecast/master/patch-notes.md';
const PATCH_NOTES_CACHE_KEY = 'patch-notes-cache';
const PATCH_NOTES_CACHE_TTL = 1000 * 60 * 30;

const SUPPORTED_LANGUAGES = ['en', 'ru', 'de', 'fr', 'uk', 'pl'];
const DEFAULT_LANGUAGE = 'en';
const LANGUAGE_NAMES = {
    en: "English",
    ru: "Русский",
    de: "Deutsch",
    fr: "Français",
    uk: "Українська",
    pl: "Polski"
};

const TAB_LABELS = {
    "general": "General",
    "features": "Features",
    "about": "About",
    "donate": "Donate"
};

let translations = {};
let currentLanguage = DEFAULT_LANGUAGE;

function detectBrowserLanguage() {
    const browserLang = navigator.language?.split('-')[0] || navigator.userLanguage?.split('-')[0];
    return SUPPORTED_LANGUAGES.includes(browserLang) ? browserLang : DEFAULT_LANGUAGE;
}

async function loadTranslationsFromFile(lang) {
    try {
        const url = CLIENT_RUNTIME.getURL(`_locales/${lang}/forecast.json`);
        const response = await fetch(url);
        if (response.ok) {
            translations[lang] = await response.json();
        }
    } catch (e) {
        console.error("Failed to load translations for " + lang, e);
    }

    if (lang !== DEFAULT_LANGUAGE && !translations[DEFAULT_LANGUAGE]) {
        try {
            const fallbackUrl = CLIENT_RUNTIME.getURL(`_locales/${DEFAULT_LANGUAGE}/forecast.json`);
            const fallbackResponse = await fetch(fallbackUrl);
            if (fallbackResponse.ok) {
                translations[DEFAULT_LANGUAGE] = await fallbackResponse.json();
            }
        } catch (e) {
            console.error("Failed to load fallback translations", e);
        }
    }
}

function t(key, fallback = null) {
    const langTranslations = translations[currentLanguage] || translations[DEFAULT_LANGUAGE];
    const result = langTranslations?.[key];
    if (result !== undefined) return result;
    if (currentLanguage !== DEFAULT_LANGUAGE) {
        const defaultResult = translations[DEFAULT_LANGUAGE]?.[key];
        if (defaultResult !== undefined) return defaultResult;
    }
    return fallback !== null ? fallback : key;
}

function localizeDocument() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        el.textContent = t(key, el.textContent);
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        el.placeholder = t(key, el.placeholder);
    });
    document.querySelectorAll('[data-i18n-html]').forEach(el => {
        const key = el.getAttribute('data-i18n-html');
        el.innerHTML = t(key, el.innerHTML);
    });
}

const PatchNotesManager = {
    currentVersion: null,

    async init() {
        this.currentVersion = CLIENT_RUNTIME.getManifest().version;
        await this.loadAndDisplay();
    },

    async loadAndDisplay() {
        const container = document.getElementById('patch-notes-container');
        if (!container) return;

        try {
            const content = await this.fetchWithCache();
            const patchNotes = this.parse(content);
            this.render(container, patchNotes);
        } catch (error) {
            console.error('Failed to load patch notes:', error);
            container.innerHTML = `<div class="patch-notes-error">${t('failed_load_patch_notes')}</div>`;
        }
    },

    async fetchWithCache() {
        if (isTest) {
            const url = CLIENT_RUNTIME.getURL('patch-notes.md');
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Failed to load local file: ${response.status}`);
            return await response.text();
        }

        try {
            const cached = await StorageUtils.get([PATCH_NOTES_CACHE_KEY, `${PATCH_NOTES_CACHE_KEY}-time`]);
            const cachedData = cached[PATCH_NOTES_CACHE_KEY];
            const cachedTime = cached[`${PATCH_NOTES_CACHE_KEY}-time`];

            if (cachedData && cachedTime && (Date.now() - cachedTime < PATCH_NOTES_CACHE_TTL)) {
                return cachedData;
            }
        } catch (e) {
        }

        const response = await fetch(PATCH_NOTES_URL);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const content = await response.text();

        try {
            await StorageUtils.set({
                [PATCH_NOTES_CACHE_KEY]: content,
                [`${PATCH_NOTES_CACHE_KEY}-time`]: Date.now()
            });
        } catch (e) {
        }

        return content;
    },

    sanitizeText(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    sanitizeHtml(html) {
        const div = document.createElement('div');
        div.innerHTML = html;

        div.querySelectorAll('script').forEach(el => el.remove());

        div.querySelectorAll('*').forEach(el => {
            Array.from(el.attributes).forEach(attr => {
                if (attr.name.startsWith('on') ||
                    (attr.name === 'href' && attr.value.toLowerCase().startsWith('javascript:'))) {
                    el.removeAttribute(attr.name);
                }
            });
        });

        return div.innerHTML;
    },

    parse(content) {
        const patchNotes = [];
        const lines = content.split(/\r?\n/);
        let currentNote = null;

        for (const rawLine of lines) {
            const line = rawLine.trim();
            const headerMatch = line.match(/^\[([^\]]+)\]\s*(.+)$/);

            if (headerMatch) {
                if (currentNote) {
                    patchNotes.push(currentNote);
                }
                currentNote = {
                    version: headerMatch[1],
                    title: headerMatch[2],
                    description: [],
                    images: []
                };
            } else if (currentNote) {
                const imgMatch = line.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/i);
                if (imgMatch) {
                    const altMatch = line.match(/alt=["']([^"']+)["']/i);
                    currentNote.images.push({
                        src: imgMatch[1],
                        alt: altMatch ? altMatch[1] : 'Patch note image'
                    });
                } else if (line.trim()) {
                    currentNote.description.push(line.trim());
                }
            }
        }

        if (currentNote) {
            patchNotes.push(currentNote);
        }

        return patchNotes;
    },

    compareVersions(v1, v2) {
        const parts1 = v1.split('.').map(Number);
        const parts2 = v2.split('.').map(Number);

        for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
            const p1 = parts1[i] || 0;
            const p2 = parts2[i] || 0;
            if (p1 > p2) return 1;
            if (p1 < p2) return -1;
        }
        return 0;
    },

    render(container, patchNotes) {
        if (patchNotes.length === 0) {
            container.innerHTML = `<div class="patch-notes-error">${t('no_patch_notes')}</div>`;
            return;
        }

        const loadingSvgUrl = CLIENT_RUNTIME.getURL('src/visual/icons/loading.svg');
        const loadedSvgUrl = CLIENT_RUNTIME.getURL('src/visual/icons/loaded.svg');

        const notesHtml = patchNotes.map(note => {
            const isReleased = this.compareVersions(this.currentVersion, note.version) >= 0;
            const tooltipText = isReleased ? t('update_installed') : t('update_pending_review');
            const iconUrl = isReleased ? loadedSvgUrl : loadingSvgUrl;

            const safeVersion = this.sanitizeText(note.version);
            const safeTitle = this.sanitizeText(note.title);

            const imagesHtml = note.images.length > 0
                ? `<div class="patch-note-images${note.images.length === 1 ? ' single' : ''}">${note.images
                    .map(img => {
                        const imgTag = `<img class="patch-note-image" src="${img.src}" alt="${this.sanitizeText(img.alt)}" loading="lazy">`;
                        return this.sanitizeHtml(imgTag);
                    })
                    .join('')}</div>`
                : '';

            const descriptionHtml = note.description.length > 0
                ? `<ul class="patch-note-description">${note.description.map(item => `<li>${this.sanitizeText(item)}</li>`).join('')}</ul>`
                : '';

            return `
                <div class="patch-note">
                    <div class="patch-note-header">
                        <span class="patch-note-version">${safeVersion}</span>
                        <span class="patch-note-title">${safeTitle}</span>
                        <div class="info-tooltip-wrapper patch-note-status-icon">
                            <img src="${iconUrl}" width="18" height="18" alt="">
                            <span class="info-tooltip">${tooltipText}</span>
                        </div>
                    </div>
                    ${descriptionHtml}
                    ${imagesHtml}
                </div>
            `;
        }).join('');

        container.innerHTML = notesHtml;

        container.querySelectorAll('.patch-note-image').forEach(img => {
            img.addEventListener('click', () => this.openImageOverlay(img.src, img.alt));

            img.addEventListener('error', function() {
                if (!this.dataset.retried) {
                    this.dataset.retried = 'true';
                    const originalSrc = this.src;
                    this.src = '';
                    setTimeout(() => {
                        this.src = originalSrc;
                    }, 1000);
                }
            });
        });

        this.setupStatusTooltips(container);
    },

    setupStatusTooltips(container) {
        container.querySelectorAll('.patch-note-status-icon').forEach(wrapper => {
            const tooltip = wrapper.querySelector('.info-tooltip');
            if (!tooltip) return;

            const showTooltip = () => {
                tooltip.style.visibility = 'hidden';
                tooltip.style.opacity = '0';
                tooltip.style.display = 'block';

                const wrapperRect = wrapper.getBoundingClientRect();
                const tooltipRect = tooltip.getBoundingClientRect();
                const tooltipWidth = tooltipRect.width || 200;
                const tooltipHeight = tooltipRect.height || 60;
                const padding = 8;
                const gap = 6;

                let left = wrapperRect.left + (wrapperRect.width / 2) - (tooltipWidth / 2);
                let top = wrapperRect.bottom + gap;

                if (top + tooltipHeight > window.innerHeight - padding) {
                    top = wrapperRect.top - tooltipHeight - gap;
                }

                if (top < padding) {
                    top = padding;
                }

                if (left + tooltipWidth > window.innerWidth - padding) {
                    left = window.innerWidth - tooltipWidth - padding;
                }

                if (left < padding) {
                    left = padding;
                }

                tooltip.style.left = `${left}px`;
                tooltip.style.top = `${top}px`;
                tooltip.style.display = '';
                tooltip.style.visibility = '';
                tooltip.style.opacity = '';
            };

            wrapper.addEventListener('mouseenter', showTooltip);
        });
    },

    openImageOverlay(src, alt) {
        const overlay = document.createElement('div');
        overlay.className = 'patch-note-image-overlay';

        const img = document.createElement('img');
        img.src = src;
        img.alt = alt;

        overlay.appendChild(img);
        document.body.appendChild(overlay);

        let isZoomed = false;
        let zoomLevel = 1;

        img.onload = () => {
            const displayedWidth = img.offsetWidth;
            const displayedHeight = img.offsetHeight;
            const naturalWidth = img.naturalWidth;
            const naturalHeight = img.naturalHeight;

            const scaleX = naturalWidth / displayedWidth;
            const scaleY = naturalHeight / displayedHeight;
            zoomLevel = Math.min(Math.max(scaleX, scaleY), 2.5);

            img.style.setProperty('--zoom-level', zoomLevel);
        };

        img.addEventListener('mouseenter', () => {
            if (isZoomed) return;
            isZoomed = true;
            img.classList.add('zoomed');
        });

        img.addEventListener('mousemove', (e) => {
            if (!isZoomed) return;
            const rect = img.getBoundingClientRect();
            const x = ((e.clientX - rect.left) / rect.width) * 100;
            const y = ((e.clientY - rect.top) / rect.height) * 100;
            img.style.transformOrigin = `${x}% ${y}%`;
        });

        overlay.addEventListener('mouseleave', () => {
            isZoomed = false;
            img.classList.remove('zoomed');
            img.style.transformOrigin = 'center center';
        });

        overlay.addEventListener('click', () => {
            overlay.remove();
        });
    }
};

const StorageUtils = {
    async get(keys) {
        return new Promise((resolve, reject) => {
            CLIENT_STORAGE.get(keys, resolve);
        });
    },

    async set(items) {
        return new Promise((resolve, reject) => {
            CLIENT_STORAGE.set(items, resolve);
        });
    }
};

const SettingsManager = {
    defaults: {
        isEnabled: true,
        sliderValue: 30,
        matchroom: true,
        eloranking: true,
        matchhistory: true,
        poscatcher: true,
        integrations: true,
        eloHistoryCalculation: true,
        matchCounter: true,
        coloredStatsKDA: true,
        coloredStatsADR: true,
        coloredStatsKD: true,
        coloredStatsKR: true,
        showFCR: true,
        coloredStatsFCR: true
    },

    async load() {
        try {
            const keys = ['isEnabled', 'sliderValue', 'matchroom', 'eloranking', 'matchhistory', 'poscatcher',
                'eloHistoryCalculation', 'matchCounter', 'coloredStatsKDA', 'coloredStatsADR', 'coloredStatsKD',
                'coloredStatsKR', 'showFCR', 'coloredStatsFCR',
                ...CS2_MAPS.flatMap(map => [`${map}Enabled`, `${map}Message`]), 'integrations'];

            const settings = await StorageUtils.get(keys);

            this.applySettings(settings);

            this.loadQuickPositionSettings(settings);

            this.loadMatchHistorySettings(settings);

        } catch (error) {
            console.error("Error loading settings:", error);
        }
    },

    applySettings(settings) {
        const elements = {
            toggleExtension: 'isEnabled',
            rangeSlider: 'sliderValue',
            matchroom: 'matchroom',
            eloranking: 'eloranking',
            matchhistory: 'matchhistory',
            integrations: 'integrations'
        };

        Object.entries(elements).forEach(([elementId, settingKey]) => {
            const element = document.getElementById(elementId);
            if (!element) return;

            const value = settings[settingKey] ?? this.defaults[settingKey];

            if (element.type === 'checkbox') {
                element.checked = value;
            } else if (element.type === 'range') {
                element.value = value;
                const display = document.getElementById('sliderValue');
                if (display) display.textContent = value;
            }
        });

        const matchroomEnabled = settings.matchroom ?? this.defaults.matchroom;
        this.updateDependentSettings('matchroom', ['#analyzeLimit'], matchroomEnabled);
    },

    loadQuickPositionSettings(settings) {
        const quickPositionToggle = document.getElementById('poscatcher');
        if (quickPositionToggle) {
            quickPositionToggle.checked = settings.poscatcher ?? this.defaults.poscatcher;
        }

        CS2_MAPS.forEach(map => {
            const enabledToggle = document.getElementById(`${map}Enabled`);
            const messageInput = document.getElementById(`${map}Message`);
            const counter = document.getElementById(`${map}Counter`);

            if (enabledToggle) {
                enabledToggle.checked = settings[`${map}Enabled`] || false;
            }

            if (messageInput) {
                messageInput.value = settings[`${map}Message`] || '';
                if (counter) {
                    counter.textContent = `${messageInput.value.length}`;
                    UIUtils.updateCharCounter(counter, messageInput.value.length, 100);
                }
            }
        });

        this.updateMapSettingsVisibility(quickPositionToggle?.checked ?? this.defaults.poscatcher);
    },

    loadMatchHistorySettings(settings) {
        const matchHistoryToggle = document.getElementById('matchhistory');
        if (matchHistoryToggle) {
            matchHistoryToggle.checked = settings.matchhistory ?? this.defaults.matchhistory;
        }

        const settingsElements = {
            eloHistoryCalculation: 'eloHistoryCalculation',
            matchCounter: 'matchCounter',
            coloredStatsKDA: 'coloredStatsKDA',
            coloredStatsADR: 'coloredStatsADR',
            coloredStatsKD: 'coloredStatsKD',
            coloredStatsKR: 'coloredStatsKR',
            coloredStatsFCR: 'coloredStatsFCR',
            showFCR: 'showFCR'
        };

        Object.entries(settingsElements).forEach(([elementId, settingKey]) => {
            const element = document.getElementById(elementId);
            if (element) {
                element.checked = settings[settingKey] ?? this.defaults[settingKey];
            }
        });

        const showFCR = settings.showFCR ?? this.defaults.showFCR;
        this.updateFCRColoredStatsVisibility(showFCR);

        const matchHistoryEnabled = settings.matchhistory ?? this.defaults.matchhistory;
        this.updateDependentSettings('matchhistory', ['#matchHistorySettings'], matchHistoryEnabled);
    },

    updateFCRColoredStatsVisibility(isEnabled) {
        const fcrColoredStatsContainer = document.getElementById('fcrColoredStatsContainer');
        if (!fcrColoredStatsContainer) return;

        if (isEnabled) {
            fcrColoredStatsContainer.classList.remove('hidden-cell');
        } else {
            fcrColoredStatsContainer.classList.add('hidden-cell');
        }
    },

    async save(data) {
        try {
            await StorageUtils.set(data);
        } catch (error) {
            console.error("Error saving settings:", error);
        }
    },

    updateDependentSettings(parentId, dependentSelectors, isEnabled) {
        dependentSelectors.forEach(selector => {
            const element = document.querySelector(selector);
            if (element) {
                element.classList.toggle('visible', isEnabled);
            }
        });
    },

    updateMapSettingsVisibility(isEnabled) {
        const mapSettings = document.getElementById('mapSettings');
        if (mapSettings) {
            mapSettings.classList.toggle('visible', isEnabled);
        }
    },

    updateMapSpecificVisibility(mapName, isEnabled) {
        const mapSettingsElement = document.getElementById(`${mapName}Settings`);
        if (mapSettingsElement) {
            mapSettingsElement.classList.toggle('visible', isEnabled);
        }
    }
};

const UIUtils = {
    updateCharCounter(counter, currentLength, maxLength) {
        const percentage = (currentLength / maxLength) * 100;
        const parent = counter.parentElement;

        parent.classList.remove('warning', 'error');

        if (percentage >= 90) {
            parent.classList.add('error');
        } else if (percentage >= 75) {
            parent.classList.add('warning');
        }
    },

    setupTabs() {
        const tabButtons = document.querySelectorAll('.tab-button');
        const categories = document.querySelectorAll('.settings-category');

        tabButtons.forEach(button => {
            const tabName = button.dataset.tab;
            const translationKey = `tab_${tabName}`;
            button.innerHTML = `<span>${t(translationKey, TAB_LABELS[tabName] || tabName)}</span>`;
        });

        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                tabButtons.forEach(btn => btn.classList.remove('active'));
                categories.forEach(category => category.classList.remove('active-category'));

                button.classList.add('active');
                document.getElementById(button.dataset.tab).classList.add('active-category');
            });
        });
    },


    async startOnlineUpdater() {
        await updateOnline();

        setInterval(async () => {
            await updateOnline();
        }, 1000 * 30);
    },

    async loadManifestInfo() {
        const manifest = CLIENT_RUNTIME.getManifest();

        const elements = {
            version: manifest.version,
            author: manifest.author
        };

        Object.entries(elements).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) element.textContent = value;
        });
    }
};

async function updateOnline() {
    let onlineElement = document.getElementById("online");
    if (onlineElement) {
        try {
            const res = await fetch(`https://api.fforecast.net/session/online`);
            if (!res.ok) throw new Error(`Error on fetching online: ${res.statusText}`);
            let online = await res.json();

            const currentValue = Number.parseInt(onlineElement.textContent) || 0;
            const newValue = online.online;

            if (currentValue !== newValue) {
                animateValue(onlineElement, currentValue, newValue);
            }
        } catch (error) {
            console.error('Failed to update online count:', error);
        }
    }
}

function animateValue(element, start, end, duration = 600) {
    if (element.animationTimer) {
        cancelAnimationFrame(element.animationTimer);
    }

    const range = end - start;
    const startTime = Date.now();

    function updateCounter() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);

        const easeProgress = 1 - Math.pow(1 - progress, 3);
        const current = start + (range * easeProgress);

        element.textContent = Math.round(current);

        if (progress < 1) {
            element.animationTimer = requestAnimationFrame(updateCounter);
        } else {
            element.textContent = end;
            delete element.animationTimer;
        }
    }

    updateCounter();
}

const EventHandlers = {
    setupMainEventListeners() {
        const toggles = ['toggleExtension', 'matchroom', 'eloranking', 'matchhistory', 'integrations'];

        toggles.forEach(toggleId => {
            const element = document.getElementById(toggleId);
            if (!element) return;

            element.addEventListener('change', async function () {
                const key = toggleId === 'toggleExtension' ? 'isEnabled' : toggleId;
                await SettingsManager.save({[key]: this.checked});

                if (toggleId === 'matchroom') {
                    SettingsManager.updateDependentSettings('matchroom', ['#analyzeLimit'], this.checked);
                }

                if (toggleId === 'matchhistory') {
                    SettingsManager.updateDependentSettings('matchhistory', ['#matchHistorySettings'], this.checked);
                }
            });
        });

        const rangeSlider = document.getElementById('rangeSlider');
        const sliderValueDisplay = document.getElementById('sliderValue');

        if (rangeSlider && sliderValueDisplay) {
            rangeSlider.addEventListener('input', async function () {
                sliderValueDisplay.textContent = this.value;
                await SettingsManager.save({sliderValue: Number.parseInt(this.value, 10)});
            });
        }

        this.setupCopyButton();
        this.setupPatchNotesToggle();
    },

    setupPatchNotesToggle() {
        const toggle = document.getElementById('patch-notes-toggle');
        const content = document.getElementById('patch-notes-container');

        if (toggle && content) {
            toggle.addEventListener('click', () => {
                toggle.classList.toggle('expanded');
                content.classList.toggle('collapsed');
            });
        }
    },

    setupCopyButton() {
        let notificationTimeout = null;
        const copyButton = document.getElementById('copyButton');

        if (copyButton) {
            copyButton.addEventListener('click', () => {
                navigator.clipboard.writeText("forecast.extension@gmail.com").then(() => {
                    const notification = document.getElementById('notification');
                    notification.classList.add('show');

                    if (notificationTimeout) clearTimeout(notificationTimeout);

                    notificationTimeout = setTimeout(() => {
                        notification.classList.remove('show');
                        notificationTimeout = null;
                    }, 2000);
                });
            });
        }
    },

    setupQuickPositionEventListeners() {
        const quickPositionToggle = document.getElementById('poscatcher');
        if (quickPositionToggle) {
            quickPositionToggle.addEventListener('change', async function () {
                await SettingsManager.save({poscatcher: this.checked});
                SettingsManager.updateMapSettingsVisibility(this.checked);
            });
        }

        CS2_MAPS.forEach(map => {
            const enabledToggle = document.getElementById(`${map}Enabled`);
            if (enabledToggle) {
                const mapCell = enabledToggle.closest('.map-cell');

                if (mapCell && enabledToggle.checked) {
                    mapCell.classList.add('enabled');
                }

                enabledToggle.addEventListener('change', async function () {
                    await SettingsManager.save({[`${map}Enabled`]: this.checked});
                    SettingsManager.updateMapSpecificVisibility(map, this.checked);

                    if (mapCell) {
                        mapCell.classList.toggle('enabled', this.checked);
                    }
                });
            }

            const messageInput = document.getElementById(`${map}Message`);
            const counter = document.getElementById(`${map}Counter`);

            if (messageInput) {
                messageInput.addEventListener('input', async function () {
                    const length = this.value.length;
                    if (counter) {
                        counter.textContent = length;
                        UIUtils.updateCharCounter(counter, length, 16);
                    }
                    await SettingsManager.save({[`${map}Message`]: this.value});
                });
            }
        });
    },

    setupMatchHistoryEventListeners() {
        const settingsToggles = [
            'eloHistoryCalculation',
            'matchCounter',
            'coloredStatsKDA',
            'coloredStatsADR',
            'coloredStatsKD',
            'coloredStatsKR',
            'showFCR',
            'coloredStatsFCR'
        ];

        settingsToggles.forEach(toggleId => {
            const element = document.getElementById(toggleId);
            if (!element) return;

            element.addEventListener('change', async function () {
                await SettingsManager.save({[toggleId]: this.checked});

                if (toggleId === 'showFCR') {
                    SettingsManager.updateFCRColoredStatsVisibility(this.checked);
                }
            });
        });
    },

    setupTooltips() {
        const infoButtons = document.querySelectorAll('.info-button');

        infoButtons.forEach(button => {
            const tooltip = button.parentElement?.querySelector('.info-tooltip')
                         || button.nextElementSibling;
            if (!tooltip) return;

            const showTooltip = () => {
                tooltip.style.visibility = 'hidden';
                tooltip.style.opacity = '0';
                tooltip.style.display = 'block';

                const buttonRect = button.getBoundingClientRect();
                const tooltipRect = tooltip.getBoundingClientRect();
                const tooltipWidth = tooltipRect.width || 200;
                const tooltipHeight = tooltipRect.height || 100;
                const padding = 8;
                const gap = 6;

                let left = buttonRect.left + (buttonRect.width / 2) - (tooltipWidth / 2);
                let top = buttonRect.bottom + gap;

                if (top + tooltipHeight > window.innerHeight - padding) {
                    top = buttonRect.top - tooltipHeight - gap;
                }

                if (left < padding) {
                    left = padding;
                }

                if (left + tooltipWidth > window.innerWidth - padding) {
                    left = window.innerWidth - tooltipWidth - padding;
                }

                if (top < padding) {
                    top = padding;
                }

                tooltip.style.left = `${left}px`;
                tooltip.style.top = `${top}px`;
                tooltip.style.display = '';
                tooltip.style.visibility = '';
                tooltip.style.opacity = '';
            };

            button.addEventListener('mouseenter', showTooltip);
            button.parentElement?.addEventListener('mouseenter', showTooltip);
        });
    }
};

window.addEventListener('message', (event) => {
    if (event.origin !== "https://www.faceit.com") return;
    if (event.data.action === 'setBackgroundColor') {
        document.body.style.backgroundColor = event.data.color;
    }
}, false);

async function initLanguage() {
    return new Promise((resolve) => {
        CLIENT_STORAGE.get(['language'], async (result) => {
            if (result.language && SUPPORTED_LANGUAGES.includes(result.language)) {
                currentLanguage = result.language;
            } else {
                currentLanguage = detectBrowserLanguage();
                CLIENT_STORAGE.set({language: currentLanguage});
            }
            await loadTranslationsFromFile(currentLanguage);
            resolve(currentLanguage);
        });
    });
}

async function setLanguage(lang) {
    if (!SUPPORTED_LANGUAGES.includes(lang)) {
        lang = DEFAULT_LANGUAGE;
    }
    currentLanguage = lang;
    CLIENT_STORAGE.set({language: lang});
    await loadTranslationsFromFile(lang);
    localizeDocument();
    updateTabs();
    await PatchNotesManager.loadAndDisplay();
}

function updateTabs() {
    const tabButtons = document.querySelectorAll('.tab-button');
    tabButtons.forEach(button => {
        const tabName = button.dataset.tab;
        const translationKey = `tab_${tabName}`;
        button.innerHTML = `<span>${t(translationKey, TAB_LABELS[tabName] || tabName)}</span>`;
    });
}

function setupLanguageSelector() {
    const languageSelect = document.getElementById('languageSelect');
    if (!languageSelect) return;

    languageSelect.value = currentLanguage;

    languageSelect.addEventListener('change', async (e) => {
        await setLanguage(e.target.value);
    });
}

document.addEventListener("DOMContentLoaded", async () => {
    try {
        await initLanguage();
        localizeDocument();

        await Promise.all([
            SettingsManager.load(),
            UIUtils.loadManifestInfo(),
            PatchNotesManager.init()
        ]);

        UIUtils.setupTabs();
        UIUtils.startOnlineUpdater();

        EventHandlers.setupMainEventListeners();
        EventHandlers.setupQuickPositionEventListeners();
        EventHandlers.setupMatchHistoryEventListeners();
        EventHandlers.setupTooltips();
        setupLanguageSelector();

    } catch (error) {
        console.error("Error during DOMContentLoaded:", error);
    }
});