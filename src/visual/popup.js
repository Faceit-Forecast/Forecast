/*
 * Copyright (c) 2025 TerraMiner. All Rights Reserved.
 */

const BROWSER_TYPE = typeof browser !== 'undefined' ? 'FIREFOX' : 'CHROMIUM';
const CS2_MAPS = ['de_dust2', 'de_mirage', 'de_nuke', 'de_ancient', 'de_train', 'de_inferno', 'de_overpass'];
const TAB_LABELS = {
    "general": "General",
    "features": "Features",
    "about": "About",
    "donate": "Donate"
};

const StorageUtils = {
    get api() {
        return BROWSER_TYPE === 'FIREFOX' ? browser.storage.sync : chrome.storage.sync;
    },

    async get(keys) {
        return new Promise((resolve, reject) => {
            if (this.api) {
                this.api.get(keys, resolve);
            } else {
                reject("Storage API not available.");
            }
        });
    },

    async set(items) {
        return new Promise((resolve, reject) => {
            if (this.api) {
                this.api.set(items, resolve);
            } else {
                reject("Storage API not available.");
            }
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
        poscatcher: false
    },

    async load() {
        try {
            const keys = ['isEnabled', 'sliderValue', 'matchroom', 'eloranking', 'matchhistory', 'poscatcher',
                ...CS2_MAPS.flatMap(map => [`${map}Enabled`, `${map}Message`])];

            const settings = await StorageUtils.get(keys);

            this.applySettings(settings);

            this.loadQuickPositionSettings(settings);

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
            matchhistory: 'matchhistory'
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
                    counter.textContent = messageInput.value.length;
                    UIUtils.updateCharCounter(counter, messageInput.value.length, 100);
                }
            }
        });

        this.updateMapSettingsVisibility(quickPositionToggle?.checked ?? this.defaults.poscatcher);
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
            const tabName = button.getAttribute('data-tab');
            button.innerHTML = `<span>${TAB_LABELS[tabName] || tabName}</span>`;
        });

        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                tabButtons.forEach(btn => btn.classList.remove('active'));
                categories.forEach(category => category.classList.remove('active-category'));

                button.classList.add('active');
                document.getElementById(button.getAttribute('data-tab')).classList.add('active-category');
            });
        });
    },

    setupInfoButtons() {
        const infoButtons = document.querySelectorAll('.info-button:not(.nested-info-button)');

        infoButtons.forEach(button => {
            button.addEventListener('click', function (e) {
                e.preventDefault();
                const settingGroup = this.closest('.setting-group');
                const description = settingGroup.querySelector('.setting-description');
                description.classList.toggle('active');
            });
        });
    },

    async startOnlineUpdater() {
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

        async function updateOnline() {
            let onlineElement = document.getElementById("online");
            if (onlineElement) {
                try {
                    const res = await fetch(`https://forecast.dargen.dev/session/online`);
                    if (!res.ok) throw new Error(`Error on fetching online: ${res.statusText}`);
                    let online = await res.json();

                    const currentValue = parseInt(onlineElement.textContent) || 0;
                    const newValue = online.online;

                    if (currentValue !== newValue) {
                        animateValue(onlineElement, currentValue, newValue);
                    }
                } catch (error) {
                    console.error('Failed to update online count:', error);
                }
            }
        }

        await updateOnline();

        setInterval(async () => {
            await updateOnline();
        }, 1000 * 30);
    },

    async loadManifestInfo() {
        const runtime = BROWSER_TYPE === 'FIREFOX' ? browser.runtime : chrome.runtime;
        const manifest = runtime.getManifest();

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

const EventHandlers = {
    setupMainEventListeners() {
        const toggles = ['toggleExtension', 'matchroom', 'eloranking', 'matchhistory'];

        toggles.forEach(toggleId => {
            const element = document.getElementById(toggleId);
            if (!element) return;

            element.addEventListener('change', async function () {
                const key = toggleId === 'toggleExtension' ? 'isEnabled' : toggleId;
                await SettingsManager.save({[key]: this.checked});

                if (toggleId === 'matchroom') {
                    SettingsManager.updateDependentSettings('matchroom', ['#analyzeLimit'], this.checked);
                }
            });
        });

        const rangeSlider = document.getElementById('rangeSlider');
        const sliderValueDisplay = document.getElementById('sliderValue');

        if (rangeSlider && sliderValueDisplay) {
            rangeSlider.addEventListener('input', async function () {
                sliderValueDisplay.textContent = this.value;
                await SettingsManager.save({sliderValue: parseInt(this.value, 10)});
            });
        }

        this.setupCopyButton();
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
                enabledToggle.addEventListener('change', async function () {
                    await SettingsManager.save({[`${map}Enabled`]: this.checked});
                    SettingsManager.updateMapSpecificVisibility(map, this.checked);
                });
            }

            const messageInput = document.getElementById(`${map}Message`);
            const counter = document.getElementById(`${map}Counter`);

            if (messageInput && counter) {
                messageInput.addEventListener('input', async function () {
                    const length = this.value.length;
                    counter.textContent = length;
                    UIUtils.updateCharCounter(counter, length, 16);
                    await SettingsManager.save({[`${map}Message`]: this.value});
                });
            }
        });
    }
};

window.addEventListener('message', (event) => {
    if (event.origin !== "https://www.faceit.com") return;
    if (event.data.action === 'setBackgroundColor') {
        document.body.style.backgroundColor = event.data.color;
    }
}, false);

document.addEventListener("DOMContentLoaded", async () => {
    try {
        await Promise.all([
            SettingsManager.load(),
            UIUtils.loadManifestInfo()
        ]);

        UIUtils.setupTabs();
        UIUtils.setupInfoButtons();
        UIUtils.startOnlineUpdater();

        EventHandlers.setupMainEventListeners();
        EventHandlers.setupQuickPositionEventListeners();

    } catch (error) {
        console.error("Error during DOMContentLoaded:", error);
    }
});