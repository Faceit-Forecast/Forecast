/*
 * Copyright (c) 2025 TerraMiner. All Rights Reserved.
 */

const isTest = false;

const FIREFOX = "FIREFOX"
const CHROMIUM = "CHROMIUM"

const BROWSER_TYPE = typeof browser === 'undefined' ? CHROMIUM : FIREFOX
const CLIENT_API = BROWSER_TYPE === FIREFOX ? browser : chrome;
const CLIENT_RUNTIME = CLIENT_API.runtime;
const CLIENT_STORAGE_SYNC = CLIENT_API.storage.sync;

const MAPS_CONFIG_URL = 'https://cdn.fforecast.net/config/maps-config.json';
const MAPS_CONFIG_CACHE_KEY = 'maps-config-cache';
const MAPS_CONFIG_CACHE_TTL = 1000 * 60 * 60 * 6;

const MAPS_ICONS_CDN_URL = 'https://cdn.fforecast.net/web/images/maps';
const MAPS_ICONS_SIZE = 48;

let mapsConfig = null;
let CS2_MAPS = [];

const PATCH_NOTES_URL = 'https://raw.githubusercontent.com/TerraMiner/Forecast/master/patch-notes.md';
const PATCH_NOTES_CACHE_KEY = 'patch-notes-cache';
const PATCH_NOTES_CACHE_TTL = 1000 * 60 * 30;

const SUPPORTED_LANGUAGES = ['en', 'ru', 'de', 'fr', 'uk', 'pl'];
const DEFAULT_LANGUAGE = 'en';

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

            img.addEventListener('error', function () {
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
        return new Promise((resolve, _) => {
            CLIENT_STORAGE_SYNC.get(keys, resolve);
        });
    },

    async set(items) {
        return new Promise((resolve, _) => {
            CLIENT_STORAGE_SYNC.set(items, resolve);
        });
    }
};

const AUTH_HOST = 'https://auth.fforecast.net';
const BASE_API_URL = 'https://api.fforecast.net';
const AUTH_STORAGE_KEY = 'forecast_auth';
const DEVICE_ID_KEY = 'deviceId';

const AuthManager = {
    state: {
        isAuthenticated: false,
        user: null
    },
    authCheckInterval: null,
    deviceId: null,
    authTabId: null,
    isLoggingIn: false,
    authWindow: null,
    authWindowCheckInterval: null,
    authState: 'idle',

    async init() {
        try {
            this.deviceId = await this.getDeviceId();

            const stored = await StorageUtils.get([AUTH_STORAGE_KEY]);
            if (stored[AUTH_STORAGE_KEY]) {
                const authData = stored[AUTH_STORAGE_KEY];
                if (authData.expiresAt > Date.now()) {
                    this.state = {
                        isAuthenticated: true,
                        user: authData.user
                    };
                }
            }


        } catch (e) {
            console.warn('[Auth] Init failed:', e);
        }
        this.updateUI();
        return this.state;
    },

    async getDeviceId() {
        return new Promise((resolve) => {
            CLIENT_STORAGE_SYNC.get([DEVICE_ID_KEY], async (result) => {
                if (result[DEVICE_ID_KEY]) {
                    resolve(result[DEVICE_ID_KEY]);
                } else {
                    const newDeviceId = await this.registerDevice();
                    if (newDeviceId) {
                        CLIENT_STORAGE_SYNC.set({[DEVICE_ID_KEY]: newDeviceId});
                    }
                    resolve(newDeviceId);
                }
            });
        });
    },

    async registerDevice() {
        try {
            const version = CLIENT_RUNTIME.getManifest().version;
            const res = await fetch('https://api.fforecast.net/v2/extension/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Extension-Version': version
                },
                body: JSON.stringify({})
            });

            if (!res.ok) return null;

            const data = await res.json();
            return data.deviceId || null;
        } catch (err) {
            console.error('[Auth] Failed to register device:', err);
            return null;
        }
    },

    async login() {
        try {
            if (this.isLoggingIn) {
                return {success: false, error: 'Login already in progress'};
            }

            this.isLoggingIn = true;
            this.authState = 'loading';
            this.updateUI();

            if (!this.deviceId) {
                this.deviceId = await this.getDeviceId();
            }

            if (!this.deviceId) {
                console.error('[Auth] No device ID available');
                this.handleAuthError('No device ID');
                return {success: false, error: 'No device ID'};
            }

            const stateParam = this.generateState();
            await StorageUtils.set({
                'oauth_state': stateParam,
                'auth_pending': true,
                'auth_pending_timestamp': Date.now()
            });

            const startUrl = `${AUTH_HOST}/faceit/start?device_id=${encodeURIComponent(this.deviceId)}&state=${stateParam}&json=true`;

            let authUrl;
            try {
                const resp = await fetch(startUrl, {
                    method: 'GET',
                    headers: {'Accept': 'application/json'}
                });
                if (!resp.ok) throw new Error('Auth service start failed: ' + resp.status);
                const payload = await resp.json();
                authUrl = payload.authUrl;
            } catch (err) {
                console.warn('[Auth] Failed to fetch authUrl, falling back', err);
                authUrl = `${AUTH_HOST}/faceit/start?state=${stateParam}&device_id=${encodeURIComponent(this.deviceId)}`;
            }

            const response = await CLIENT_RUNTIME.sendMessage({
                type: 'START_AUTH',
                data: {
                    authUrl: authUrl,
                    state: stateParam,
                    deviceId: this.deviceId
                }
            });

            if (!response.success) {
                this.handleAuthError(response.error);
                return response;
            }

            return {success: true};

        } catch (e) {
            console.error('[Auth] Login failed:', e);
            this.handleAuthError(e.message);
            return {success: false, error: e.message};
        }
    },

    handleAuthSuccess(user) {
        this.authState = 'success';
        this.state = {isAuthenticated: true, user: user};
        this.updateUI();

        setTimeout(() => {
            this.isLoggingIn = false;
            this.authState = 'idle';
            this.updateUI();
        }, 1000);
    },

    handleAuthError(errorMessage) {
        console.error('[Auth] Authentication error:', errorMessage);

        this.authState = 'error';
        this.updateUI();

        setTimeout(() => {
            this.isLoggingIn = false;
            this.authState = 'idle';
            this.updateUI();
        }, 2000);
    },

    generateState() {
        return crypto.randomUUID();
    },

    async logout() {
        try {
            if (this.deviceId) {
                await fetch(`${BASE_API_URL}/v1/auth/unlink?faceit_id=${this.state.user.playerId}`, {
                    method: 'POST',
                    headers: {'X-Device-ID': this.deviceId}
                });
            }
            await StorageUtils.set({[AUTH_STORAGE_KEY]: null});
            this.state = {isAuthenticated: false, user: null};
            this.isLoggingIn = false;
            this.authState = 'idle';
            this.updateUI();
            return {success: true};
        } catch (e) {
            console.error('[Auth] Logout failed:', e);
            return {success: false, error: e.message};
        }
    },

    updateUI() {
        const authSection = document.getElementById('authSection');
        if (!authSection) return;

        if (this.state.isAuthenticated && this.state.user && this.authState === 'idle') {
            authSection.innerHTML = `
                <label data-i18n="account">${t('account')}</label>
                <div class="auth-user">
                    <img class="auth-avatar" src="" alt="" style="display:none;">
                    <span class="auth-nickname">${this.state.user.nickname}</span>
                    <button id="logoutBtn" class="auth-btn auth-btn-logout">${t('logout')}</button>
                </div>
            `;

            this.loadAvatar(this.state.user.playerId);
            document.getElementById('logoutBtn')?.addEventListener('click', () => this.logout());
        } else {
            let btnClass = 'auth-btn';
            if (this.authState === 'loading') btnClass += ' loading';
            if (this.authState === 'success') btnClass += ' success';
            if (this.authState === 'error') btnClass += ' error';

            authSection.innerHTML = `
                <label data-i18n="account">${t('account')}</label>
                <button id="loginBtn" class="${btnClass}">
                    <div class="auth-btn-icon">
                        <img src="icons/faceit.svg" class="faceit-icon" width="16" height="16" alt="">
                        <img src="icons/loading.svg" class="loading-icon" width="16" height="16" alt="">
                        <img src="icons/loaded.svg" class="success-icon" width="16" height="16" alt="">
                        <img src="icons/error.svg" class="error-icon" width="16" height="16" alt="">
                    </div>
                    ${t('login')}
                </button>
            `;

            const loginBtn = document.getElementById('loginBtn');
            if (loginBtn && this.authState === 'idle') {
                loginBtn.addEventListener('click', () => this.login());
            }
        }
    },

    async loadAvatar(playerId) {
        try {
            const response = await fetch(`${BASE_API_URL}/v1/faceit/avatar/${playerId}`);
            if (response.ok) {
                const data = await response.json();
                const avatar = data.avatar;
                if (avatar) {
                    const img = document.querySelector('.auth-avatar');
                    if (img) {
                        img.src = avatar;
                        img.style.display = 'inline-block';
                    }
                }
            }
        } catch (e) {
            console.warn('Failed to load avatar:', e);
        }
    }
};

const MapsConfigManager = {
    defaultConfig: {
        version: 1,
        maps: {
            de_dust2: {active: true, display: "DUST 2", faceitName: "Dust2", icon: "map_icon_de_dust2.png"},
            de_mirage: {active: true, display: "MIRAGE", faceitName: "Mirage", icon: "map_icon_de_mirage.png"},
            de_nuke: {active: true, display: "NUKE", faceitName: "Nuke", icon: "map_icon_de_nuke.png"},
            de_ancient: {active: true, display: "ANCIENT", faceitName: "Ancient", icon: "map_icon_de_ancient.png"},
            de_anubis: {active: true, display: "ANUBIS", faceitName: "Anubis", icon: "map_icon_de_anubis.png"},
            de_train: {active: false, display: "TRAIN", faceitName: "Train", icon: "map_icon_de_train.png"},
            de_inferno: {active: true, display: "INFERNO", faceitName: "Inferno", icon: "map_icon_de_inferno.png"},
            de_overpass: {active: true, display: "OVERPASS", faceitName: "Overpass", icon: "map_icon_de_overpass.png"}
        }
    },

    async init() {
        try {
            mapsConfig = await this.fetchWithCache();
        } catch (error) {
            console.error('Failed to load maps config, using default:', error);
            mapsConfig = this.defaultConfig;
        }
        CS2_MAPS = this.getActiveMaps();
        this.renderMapGrid();
    },

    async fetchWithCache() {
        try {
            const cached = await StorageUtils.get([MAPS_CONFIG_CACHE_KEY, `${MAPS_CONFIG_CACHE_KEY}-time`]);
            const cachedData = cached[MAPS_CONFIG_CACHE_KEY];
            const cachedTime = cached[`${MAPS_CONFIG_CACHE_KEY}-time`];

            if (cachedData && cachedTime && (Date.now() - cachedTime < MAPS_CONFIG_CACHE_TTL)) {
                return cachedData;
            }
        } catch (e) {
        }

        const response = await fetch(`${MAPS_CONFIG_URL}?_=${Date.now()}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const config = await response.json();

        try {
            await StorageUtils.set({
                [MAPS_CONFIG_CACHE_KEY]: config,
                [`${MAPS_CONFIG_CACHE_KEY}-time`]: Date.now()
            });
        } catch (e) {
        }

        return config;
    },

    getActiveMaps() {
        if (!mapsConfig || !mapsConfig.maps) return [];
        return Object.keys(mapsConfig.maps).filter(mapId => mapsConfig.maps[mapId].active);
    },

    getAllMaps() {
        if (!mapsConfig || !mapsConfig.maps) return {};
        return mapsConfig.maps;
    },

    renderMapGrid() {
        const mapGrid = document.querySelector('#mapSettings .map-grid');
        if (!mapGrid) return;

        mapGrid.innerHTML = '';

        const maps = this.getAllMaps();
        Object.entries(maps).forEach(([mapId, mapData]) => {
            if (!mapData.active) return;

            const mapCell = document.createElement('div');
            mapCell.className = 'map-cell';
            mapCell.innerHTML = `
                <img class="map-icon" src="${MAPS_ICONS_CDN_URL}/${MAPS_ICONS_SIZE}/${mapData.icon}" alt="${mapData.display}">
                <span class="map-cell-name">${mapData.display}</span>
                <input type="text" id="${mapId}Message" placeholder="message"
                       data-i18n-placeholder="map_message_placeholder" maxlength="16"
                       aria-label="Message for ${mapData.display}">
                <label class="switch map-switch">
                    <input type="checkbox" id="${mapId}Enabled" aria-label="Enable ${mapData.display}">
                    <span class="slider"></span>
                </label>
            `;
            mapGrid.appendChild(mapCell);
        });

        mapGrid.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            const key = el.getAttribute('data-i18n-placeholder');
            el.placeholder = t(key, el.placeholder);
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
        matchCounter: true,
        coloredStatsKDA: true,
        coloredStatsADR: true,
        coloredStatsKD: true,
        coloredStatsKR: true,
        showFCR: true,
        coloredStatsFCR: true,
        roundedStats: false
    },

    async load() {
        try {
            const keys = ['isEnabled', 'sliderValue', 'matchroom', 'eloranking', 'matchhistory', 'poscatcher',
                'matchCounter', 'coloredStatsKDA', 'coloredStatsADR', 'coloredStatsKD',
                'coloredStatsKR', 'showFCR', 'coloredStatsFCR', 'roundedStats',
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
            matchCounter: 'matchCounter',
            coloredStatsKDA: 'coloredStatsKDA',
            coloredStatsADR: 'coloredStatsADR',
            coloredStatsKD: 'coloredStatsKD',
            coloredStatsKR: 'coloredStatsKR',
            coloredStatsFCR: 'coloredStatsFCR',
            showFCR: 'showFCR',
            roundedStats: 'roundedStats'
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

const UIBuilder = {
    ICON_PATHS: {
        info: 'icons/info-outline.svg',
        discord: 'icons/discord.svg',
        github: 'icons/github.svg',
        email: 'icons/gmail.svg',
        coffee: 'icons/buymeacoffee.svg',
        boosty: 'icons/boosty.svg',
        chevron: 'icons/chevron-down.svg',
        website: 'icons/rawlogo.svg',
        faceit: 'icons/faceit.svg'
    },

    icon(name, width = 20, height = 20, className = '') {
        const path = this.ICON_PATHS[name];
        if (!path) return '';
        const cls = className ? ` class="${className}"` : '';
        return `<img src="${path}" width="${width}" height="${height}"${cls} alt="">`;
    },

    FEATURES_CONFIG: [
        {
            id: 'matchhistory',
            labelKey: 'advanced_match_history',
            descKey: 'advanced_match_history_desc',
            nestedId: 'matchHistorySettings',
            nestedContent: 'matchHistoryGrid'
        },
        {
            id: 'eloranking',
            labelKey: 'new_elo_rankings',
            descKey: 'new_elo_rankings_desc'
        },
        {
            id: 'matchroom',
            labelKey: 'matchroom_stats',
            descKey: 'matchroom_stats_desc',
            nestedId: 'analyzeLimit',
            nestedContent: 'rangeSlider'
        },
        {
            id: 'poscatcher',
            labelKey: 'quick_position_setup',
            descKey: 'quick_position_setup_desc',
            nestedId: 'mapSettings',
            nestedContent: 'mapGrid'
        },
        {
            id: 'integrations',
            labelKey: 'integrations',
            descKey: 'integrations_desc'
        }
    ],

    MATCH_HISTORY_SETTINGS: [
        {id: 'matchCounter', labelKey: 'match_counter', descKey: 'match_counter_desc'},
        {id: 'coloredStatsKDA', labelKey: 'kda_color', descKey: 'kda_color_desc'},
        {id: 'coloredStatsADR', labelKey: 'adr_color', descKey: 'adr_color_desc'},
        {id: 'coloredStatsKD', labelKey: 'kd_color', descKey: 'kd_color_desc'},
        {id: 'coloredStatsKR', labelKey: 'kr_color', descKey: 'kr_color_desc'},
        {id: 'showFCR', label: 'FCR', descKey: 'fcr_desc', cellId: 'fcrSettingsCell'},
        {
            id: 'coloredStatsFCR',
            labelKey: 'fcr_color',
            descKey: 'fcr_color_desc',
            className: 'hidden-cell',
            cellId: 'fcrColoredStatsContainer'
        },
        {id: 'roundedStats', labelKey: 'rounded_stats', descKey: 'rounded_stats_desc'}
    ],

    ABOUT_LINKS: [
        {labelKey: 'discord', href: 'https://discord.gg/5ZPaVzUEXR', icon: 'discord'},
        {label: 'GitHub', href: 'https://github.com/Faceit-Forecast/Forecast', icon: 'github'}
    ],

    DONATE_LINKS: [
        {label: 'Buy Me A Coffee', href: 'https://www.buymeacoffee.com/terraminer', icon: 'coffee'},
        {label: 'Boosty', href: 'https://boosty.to/terraminer', icon: 'boosty'}
    ],

    createSwitch(id, checked = true) {
        return `<label class="switch"><input type="checkbox" id="${id}" ${checked ? 'checked' : ''}><span class="slider"></span></label>`;
    },

    createInfoTooltip(descKey, small = false) {
        const size = small ? 12 : 16;
        const icon = this.icon('info', size, size, 'info-icon');
        return `<div class="info-tooltip-wrapper"><div class="info-button" aria-label="Info">${icon}</div><div class="info-tooltip"><p data-i18n="${descKey}">${t(descKey)}</p></div></div>`;
    },

    createSettingsCell(config) {
        const extraClass = config.className ? ` ${config.className}` : '';
        const cellId = config.cellId ? ` id="${config.cellId}"` : '';
        const labelAttr = config.labelKey ? `data-i18n="${config.labelKey}"` : '';
        const labelText = config.labelKey ? t(config.labelKey, config.label || '') : (config.label || '');

        return `<div class="settings-cell${extraClass}"${cellId}><span class="settings-cell-label" ${labelAttr}>${labelText}</span>${this.createInfoTooltip(config.descKey, true)}${this.createSwitch(config.id)}</div>`;
    },

    createSettingGroup(config) {
        let nestedHtml = '';
        if (config.nestedId) {
            let nestedContent = '';
            if (config.nestedContent === 'matchHistoryGrid') {
                nestedContent = '<div class="settings-grid" id="matchHistorySettingsGrid"></div>';
            } else if (config.nestedContent === 'rangeSlider') {
                nestedContent = `<div class="setting-item"><div class="setting-header"><label for="rangeSlider" data-i18n="match_amount">${t('match_amount')}</label></div><div class="slider-controls"><input type="range" id="rangeSlider" class="range-slider" min="5" max="100" value="30"><span id="sliderValue">30</span></div></div>`;
            } else if (config.nestedContent === 'mapGrid') {
                nestedContent = '<div class="map-grid"></div>';
            }
            nestedHtml = `<div class="nested-setting visible" id="${config.nestedId}">${nestedContent}</div>`;
        }

        return `<div class="setting-group"><div class="setting-item"><div class="setting-header"><label for="${config.id}" data-i18n="${config.labelKey}">${t(config.labelKey)}</label>${this.createInfoTooltip(config.descKey)}</div>${this.createSwitch(config.id)}</div>${nestedHtml}</div>`;
    },

    createAboutCell(config) {
        const labelAttr = config.labelKey ? `data-i18n="${config.labelKey}"` : '';
        const labelText = config.labelKey ? t(config.labelKey) : config.label;
        const icon = this.icon(config.icon, 20, 20);

        if (config.href) {
            return `<div class="about-cell"><span class="about-cell-label" ${labelAttr}>${labelText}</span><a href="${config.href}" target="_blank" class="about-button">${icon}</a></div>`;
        }
        return `<div class="about-cell"><span class="about-cell-label" ${labelAttr}>${labelText}</span><span class="${config.badgeClass}" id="${config.id}">${config.value || ''}</span></div>`;
    },

    createDonateCell(config) {
        const icon = this.icon(config.icon, 32, 32);
        return `<div class="donate-cell"><span class="donate-cell-label">${config.label}</span><a href="${config.href}" target="_blank" class="donate-button">${icon}</a></div>`;
    },

    buildMatchHistorySettings() {
        const container = document.getElementById('matchHistorySettingsGrid');
        if (!container) return;
        container.innerHTML = this.MATCH_HISTORY_SETTINGS.map(s => this.createSettingsCell(s)).join('');
    },

    buildFeaturesSection() {
        const container = document.getElementById('featuresContainer');
        if (!container) return;
        container.innerHTML = this.FEATURES_CONFIG.map(c => this.createSettingGroup(c)).join('');
    },

    buildAboutSection() {
        const grid = document.getElementById('aboutGrid');
        if (!grid) return;

        const staticCells = [
            {labelKey: 'version', id: 'version', value: '1.0.0', badgeClass: 'version-badge'},
            {labelKey: 'author', id: 'author', value: 'TerraMiner', badgeClass: 'author-badge'},
            {labelKey: 'online', id: 'online', value: '0', badgeClass: 'online-badge'}
        ];

        let html = staticCells.map(c => this.createAboutCell(c)).join('');
        html += this.ABOUT_LINKS.map(c => this.createAboutCell(c)).join('');

        html += `<div class="about-cell"><span class="about-cell-label" data-i18n="email">${t('email')}</span><button id="copyButton" class="about-button">${this.icon('email', 20, 20)}</button><div id="notification" class="notification" data-i18n="copied">${t('copied')}</div></div>`;

        html += `<div class="about-cell"><span class="about-cell-label" data-i18n="website">${t('website')}</span><a href="https://fforecast.net" target="_blank" class="about-button"><img src="icons/rawlogo.svg" alt="Website" style="width:30px;height:30px;margin:-2px"></a></div>`;

        grid.innerHTML = html;
    },

    buildDonateSection() {
        const grid = document.getElementById('donateGrid');
        if (!grid) return;
        grid.innerHTML = this.DONATE_LINKS.map(c => this.createDonateCell(c)).join('');
    },

    init() {
        this.buildFeaturesSection();
        this.buildMatchHistorySettings();
        this.buildAboutSection();
        this.buildDonateSection();
    }
};

async function updateOnline() {
    let onlineElement = document.getElementById("online");
    if (onlineElement) {
        try {
            const res = await fetch(`https://api.fforecast.net/v1/extension/online`);
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
                        notification.classList.remove('error');
                        notification.classList.add('success');
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
            'matchCounter',
            'coloredStatsKDA',
            'coloredStatsADR',
            'coloredStatsKD',
            'coloredStatsKR',
            'showFCR',
            'coloredStatsFCR',
            'roundedStats'
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


async function initLanguage() {
    return new Promise((resolve) => {
        CLIENT_STORAGE_SYNC.get(['language'], async (result) => {
            if (result.language && SUPPORTED_LANGUAGES.includes(result.language)) {
                currentLanguage = result.language;
            } else {
                currentLanguage = detectBrowserLanguage();
                CLIENT_STORAGE_SYNC.set({language: currentLanguage});
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
    CLIENT_STORAGE_SYNC.set({language: lang});
    await loadTranslationsFromFile(lang);
    localizeDocument();
    updateTabs();
    AuthManager.updateUI();
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

        UIBuilder.init();

        localizeDocument();

        await MapsConfigManager.init();

        await Promise.all([
            SettingsManager.load(),
            UIUtils.loadManifestInfo(),
            AuthManager.init()
        ]);

        UIUtils.setupTabs();

        PatchNotesManager.init().catch(err => console.error('Failed to init patch notes:', err));
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

CLIENT_RUNTIME.onMessage.addListener((message) => {
    if (message.type === 'auth_success') {
        AuthManager.handleAuthSuccess(message.user);
    } else if (message.type === 'transparent-bg') {
        document.body.style.backgroundColor = 'transparent'
    }
});

