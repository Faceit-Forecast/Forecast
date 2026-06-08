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

const PRIMARY_CDN_URL = 'https://cdn.fforecast.net';
const FALLBACK_CDN_URL = 'https://cdn.fforecast.dev';
const MAPS_CONFIG_URL_PATH = '/config/mappool.json';
const MAPS_CONFIG_CACHE_KEY = 'maps-config-cache';
const MAPS_CONFIG_CACHE_TTL = 1000 * 60 * 60 * 6;

let activeCdnUrl = PRIMARY_CDN_URL;
const MAPS_ICONS_SIZE = 48;

let mapsConfig = null;
let CS2_MAPS = [];

const PATCH_NOTES_PATH = '/config/patch-notes/';
const PATCH_NOTES_CACHE_TTL = 1000 * 60 * 60;
const PATCH_NOTES_SCROLL_THRESHOLD = 40;

const SUPPORTED_LANGUAGES = ['en', 'ru', 'de', 'fr', 'uk', 'pl'];
const DEFAULT_LANGUAGE = 'en';
const LOCALE_PATH_PREFIX = '/config/locales/';
const LOCALE_CACHE_TTL = 1000 * 60 * 60 * 6;

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

function _getLocaleLocal(key) {
    return new Promise((resolve) => {
        CLIENT_API.storage.local.get([key], (result) => resolve(result[key] ?? null));
    });
}

function _setLocaleLocal(items) {
    return new Promise((resolve) => {
        CLIENT_API.storage.local.set(items, resolve);
    });
}

async function _fetchLocaleData(lang) {
    const cacheKey = `forecast-locale-${lang}`;
    try {
        const cached = await _getLocaleLocal(cacheKey);
        const cachedTime = await _getLocaleLocal(`${cacheKey}-time`);
        if (cached && cachedTime && (Date.now() - cachedTime < LOCALE_CACHE_TTL)) {
            return cached;
        }
    } catch (e) {}

    await _ensurePopupDomain();
    const path = `${LOCALE_PATH_PREFIX}${lang}.json`;
    const cdn = activeCdnUrl;
    let data = null;
    try {
        const response = await fetch(`${cdn}${path}`);
        if (response.ok) data = await response.json();
    } catch (e) {}
    if (!data) {
        try {
            const fallbackCdn = cdn === PRIMARY_CDN_URL ? FALLBACK_CDN_URL : PRIMARY_CDN_URL;
            const response = await fetch(`${fallbackCdn}${path}`);
            if (response.ok) data = await response.json();
        } catch (e) {}
    }
    if (data) {
        try {
            await _setLocaleLocal({[cacheKey]: data, [`${cacheKey}-time`]: Date.now()});
        } catch (e) {}
        return data;
    }

    try {
        const cached = await _getLocaleLocal(cacheKey);
        if (cached) return cached;
    } catch (e) {}

    return null;
}

async function _loadBundledLocale(lang) {
    try {
        const url = CLIENT_RUNTIME.getURL(`_locales/${lang}/forecast.json`);
        const response = await fetch(url);
        if (response.ok) return await response.json();
    } catch (e) {}
    return null;
}

async function loadTranslationsFromFile(lang) {
    if (!translations[DEFAULT_LANGUAGE]) {
        const bundled = await _loadBundledLocale(DEFAULT_LANGUAGE);
        if (bundled) translations[DEFAULT_LANGUAGE] = bundled;
    }

    const data = await _fetchLocaleData(lang);
    if (data) translations[lang] = data;
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
    rev: null,
    pages: 1,
    total: 0,
    loadedPages: 0,
    loading: false,
    container: null,
    lang: null,
    servedLang: null,

    _pagePath(lang, n) {
        return lang === 'en' ? `${PATCH_NOTES_PATH}p${n}.json` : `${PATCH_NOTES_PATH}${lang}/p${n}.json`;
    },

    _pageKey(n) {
        return `patch-notes-${this.lang}-page-${n}`;
    },

    _revKey() {
        return `patch-notes-${this.lang}-rev`;
    },

    _timeKey() {
        return `patch-notes-${this.lang}-time`;
    },

    _updateLangBadge() {
        const badge = document.querySelector('.patch-notes-lang-badge');
        if (badge) badge.textContent = (this.servedLang || 'en').toUpperCase();
    },

    async init() {
        this.currentVersion = CLIENT_RUNTIME.getManifest().version;
        this.container = document.getElementById('patch-notes-container');
        if (!this.container) return;

        this.lang = (typeof currentLanguage === 'string' && currentLanguage) ? currentLanguage : 'en';

        try {
            await _ensurePopupDomain();
        } catch (e) {
        }

        await this.loadFirstPage();
        this.setupScroll();
    },

    async fetchByPath(path) {
        const cdn = activeCdnUrl;
        let response;
        try {
            response = await fetch(`${cdn}${path}`);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
        } catch (e) {
            const fallbackCdn = cdn === PRIMARY_CDN_URL ? FALLBACK_CDN_URL : PRIMARY_CDN_URL;
            response = await fetch(`${fallbackCdn}${path}`);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
        }
        return await response.json();
    },

    async fetchPage(n) {
        if (isTest) {
            const url = CLIENT_RUNTIME.getURL('patch-notes.md');
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Failed to load local file: ${response.status}`);
            const notes = this._parseMarkdown(await response.text());
            this.servedLang = 'en';
            return {rev: 'local', pageSize: notes.length, total: notes.length, pages: 1, latest: this.currentVersion, notes};
        }

        if (n === 0) {
            if (this.lang && this.lang !== 'en') {
                try {
                    const page = await this.fetchByPath(this._pagePath(this.lang, 0));
                    this.servedLang = this.lang;
                    return page;
                } catch (e) {}
            }
            this.servedLang = 'en';
            return await this.fetchByPath(this._pagePath('en', 0));
        }
        return await this.fetchByPath(this._pagePath(this.servedLang || 'en', n));
    },

    async loadFirstPage() {
        try {
            const cached = await StorageUtils.get([this._pageKey(0), this._timeKey()]);
            const cachedPage = cached[this._pageKey(0)];
            const cachedTime = cached[this._timeKey()];
            if (cachedPage && cachedTime && (Date.now() - cachedTime < PATCH_NOTES_CACHE_TTL)) {
                this._applyFirstPage(cachedPage);
                this._updateLangBadge();
                return;
            }
        } catch (e) {
        }

        let page;
        try {
            page = await this.fetchPage(0);
        } catch (error) {
            console.error('Failed to load patch notes:', error);
            try {
                const cached = await StorageUtils.get([this._pageKey(0)]);
                if (cached[this._pageKey(0)]) {
                    this._applyFirstPage(cached[this._pageKey(0)]);
                    this._updateLangBadge();
                    return;
                }
            } catch (e) {
            }
            this.container.innerHTML = `<div class="patch-notes-error">${t('failed_load_patch_notes', 'Failed to load patch notes')}</div>`;
            return;
        }

        try {
            const prev = await StorageUtils.get([this._revKey()]);
            if (prev[this._revKey()] && prev[this._revKey()] !== page.rev) {
                await this._clearPageCache();
            }
        } catch (e) {
        }

        page._served = this.servedLang;
        try {
            await StorageUtils.set({
                [this._pageKey(0)]: page,
                [this._timeKey()]: Date.now(),
                [this._revKey()]: page.rev
            });
        } catch (e) {
        }

        this._applyFirstPage(page);
        this._updateLangBadge();
    },

    _applyFirstPage(page) {
        if (page._served) this.servedLang = page._served;
        this.rev = page.rev;
        this.pages = page.pages || 1;
        this.total = page.total || (page.notes ? page.notes.length : 0);
        this.loadedPages = 0;
        this.render(page.notes, false);
        this.loadedPages = 1;
    },

    async loadMore() {
        if (this.loading || this.loadedPages >= this.pages) return;
        this.loading = true;
        const n = this.loadedPages;
        try {
            let page = null;
            try {
                const cached = await StorageUtils.get([this._pageKey(n)]);
                const c = cached[this._pageKey(n)];
                if (c && c.rev === this.rev) page = c;
            } catch (e) {
            }

            if (!page) {
                page = await this.fetchPage(n);
                if (page.rev !== this.rev) {
                    await this._clearPageCache();
                    try {
                        await StorageUtils.set({[this._timeKey()]: 0});
                    } catch (e) {
                    }
                    await this.loadFirstPage();
                    return;
                }
                try {
                    await StorageUtils.set({[this._pageKey(n)]: page});
                } catch (e) {
                }
            }

            this.render(page.notes, true);
            this.loadedPages++;
        } catch (e) {
            console.error('Failed to load more patch notes:', e);
        } finally {
            this.loading = false;
        }
    },

    setupScroll() {
        if (this.pages <= 1) return;
        this.container.addEventListener('scroll', () => {
            if (this.container.scrollTop + this.container.clientHeight >= this.container.scrollHeight - PATCH_NOTES_SCROLL_THRESHOLD) {
                this.loadMore();
            }
        });
    },

    async _clearPageCache() {
        try {
            const all = await StorageUtils.get(null);
            const prefix = `patch-notes-${this.lang}-page-`;
            const toRemove = Object.keys(all).filter(k => k.startsWith(prefix));
            if (toRemove.length) await new Promise(res => CLIENT_STORAGE_SYNC.remove(toRemove, res));
        } catch (e) {
        }
    },

    _parseMarkdown(content) {
        const patchNotes = [];
        const lines = content.split(/\r?\n/);
        let currentNote = null;

        for (const rawLine of lines) {
            const line = rawLine.trim();
            const headerMatch = line.match(/^\[([^\]]+)\]\s*(.+)$/);

            if (headerMatch) {
                if (currentNote) patchNotes.push(currentNote);
                currentNote = {version: headerMatch[1], title: headerMatch[2], description: [], images: []};
            } else if (currentNote) {
                const imgMatch = line.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/i);
                if (imgMatch) {
                    const altMatch = line.match(/alt=["']([^"']+)["']/i);
                    currentNote.images.push({src: imgMatch[1], alt: altMatch ? altMatch[1] : 'Patch note image'});
                } else if (line.trim()) {
                    currentNote.description.push(line.trim());
                }
            }
        }

        if (currentNote) patchNotes.push(currentNote);
        return patchNotes;
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

    render(notes, append) {
        if (!notes || notes.length === 0) {
            if (!append) {
                this.container.innerHTML = `<div class="patch-notes-error">${t('no_patch_notes', 'No patch notes available')}</div>`;
            }
            return;
        }

        const loadingSvgUrl = CLIENT_RUNTIME.getURL('src/visual/icons/loading.svg');
        const loadedSvgUrl = CLIENT_RUNTIME.getURL('src/visual/icons/loaded.svg');

        const notesHtml = notes.map(note => {
            const isReleased = this.compareVersions(this.currentVersion, note.version) >= 0;
            const tooltipText = isReleased ? t('update_installed', 'You have this update installed') : t('update_pending_review', 'Update is ready but the store is reviewing it. Please wait for approval.');
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

        let added;
        if (append) {
            const tmp = document.createElement('div');
            tmp.innerHTML = notesHtml;
            added = Array.from(tmp.children);
            added.forEach(el => this.container.appendChild(el));
        } else {
            this.container.innerHTML = notesHtml;
            added = Array.from(this.container.children);
        }

        added.forEach(el => this._wireNote(el));
    },

    _wireNote(el) {
        el.querySelectorAll('.patch-note-image').forEach(img => {
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

        this.setupStatusTooltips(el);
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

const QPS_PROFILES_KEY = 'qpsProfiles';
const QPS_ACTIVE_KEY = 'qpsActiveProfile';
const QPS_MAX_PROFILES = 5;

function _qpsMigrateFromFlat(mapIds, flat) {
    const maps = {};
    mapIds.forEach(id => {
        const message = flat[`${id}Message`];
        const enabled = flat[`${id}Enabled`];
        const hasMessage = typeof message === 'string' && message !== '';
        if (hasMessage || enabled !== undefined) {
            maps[id] = {
                enabled: enabled !== false,
                message: typeof message === 'string' ? message : ''
            };
        }
    });
    const name = (typeof t === 'function') ? t('qps_default_profile_name', 'Profile 1') : 'Profile 1';
    return { id: 'default', name, maps };
}

async function ensureQpsProfiles(mapIds) {
    const stored = await StorageUtils.get([QPS_PROFILES_KEY, QPS_ACTIVE_KEY]);
    let profiles = stored[QPS_PROFILES_KEY];

    if (Array.isArray(profiles) && profiles.length > 0) {
        let active = stored[QPS_ACTIVE_KEY];
        if (!active || !profiles.some(p => p.id === active)) {
            active = profiles[0].id;
            await StorageUtils.set({ [QPS_ACTIVE_KEY]: active });
        }
        return { profiles, active };
    }

    const flatKeys = [];
    (mapIds || []).forEach(id => flatKeys.push(`${id}Enabled`, `${id}Message`));
    const flat = flatKeys.length ? await StorageUtils.get(flatKeys) : {};
    const profile = _qpsMigrateFromFlat(mapIds || [], flat);
    profiles = [profile];
    await StorageUtils.set({ [QPS_PROFILES_KEY]: profiles, [QPS_ACTIVE_KEY]: profile.id });
    return { profiles, active: profile.id };
}

const DOMAIN_STORAGE_KEY_POPUP = 'active_domain';
const AUTH_STORAGE_KEY = 'forecast_auth';
const DEVICE_ID_KEY = 'deviceId';

const POPUP_DOMAIN_URLS = {
    net: { api: 'https://api.fforecast.net', auth: 'https://auth.fforecast.net', cdn: 'https://cdn.fforecast.net', site: 'https://fforecast.net' },
    dev: { api: 'https://api.fforecast.dev', auth: 'https://auth.fforecast.dev', cdn: 'https://cdn.fforecast.dev', site: 'https://fforecast.dev' }
};

let _popupDomain = null;

async function _ensurePopupDomain() {
    if (_popupDomain) return _popupDomain;
    try {
        const data = await new Promise((resolve) => {
            CLIENT_API.storage.local.get([DOMAIN_STORAGE_KEY_POPUP], resolve);
        });
        if (data[DOMAIN_STORAGE_KEY_POPUP]) {
            _popupDomain = data[DOMAIN_STORAGE_KEY_POPUP];
            activeCdnUrl = POPUP_DOMAIN_URLS[_popupDomain].cdn;
            return _popupDomain;
        }
    } catch (e) {}
    try {
        const response = await CLIENT_RUNTIME.sendMessage({ type: 'GET_ACTIVE_DOMAIN' });
        if (response && response.domain) {
            _popupDomain = response.domain;
            activeCdnUrl = POPUP_DOMAIN_URLS[_popupDomain].cdn;
            return _popupDomain;
        }
    } catch (e) {}
    _popupDomain = 'net';
    return _popupDomain;
}

async function getPopupApiUrl() {
    const domain = await _ensurePopupDomain();
    return POPUP_DOMAIN_URLS[domain].api;
}

async function getPopupAuthHost() {
    const domain = await _ensurePopupDomain();
    return POPUP_DOMAIN_URLS[domain].auth;
}

CLIENT_API.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes[DOMAIN_STORAGE_KEY_POPUP]) {
        _popupDomain = changes[DOMAIN_STORAGE_KEY_POPUP].newValue;
        activeCdnUrl = POPUP_DOMAIN_URLS[_popupDomain].cdn;
    }
});

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
    pendingState: null,

    async init() {
        try {
            this.deviceId = await this.getDeviceId();

            const stored = await StorageUtils.get([AUTH_STORAGE_KEY]);
            if (stored[AUTH_STORAGE_KEY]) {
                const authData = stored[AUTH_STORAGE_KEY];
                if (authData.expiresAt > Date.now()) {
                    const serverStatus = await this.verifySessionStatus();
                    if (serverStatus === 'unlinked') {
                        await StorageUtils.set({[AUTH_STORAGE_KEY]: null});
                        this.state = {isAuthenticated: false, user: null};
                    } else {
                        this.state = {
                            isAuthenticated: true,
                            user: authData.user
                        };

                        authData.expiresAt = Date.now() + (7 * 24 * 60 * 60 * 1000);
                        await StorageUtils.set({[AUTH_STORAGE_KEY]: authData});
                    }
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
            CLIENT_API.storage.local.get([DEVICE_ID_KEY], async (result) => {
                if (result[DEVICE_ID_KEY]) {
                    resolve(result[DEVICE_ID_KEY]);
                } else {
                    const newDeviceId = await this.registerDevice();
                    if (newDeviceId) {
                        CLIENT_API.storage.local.set({[DEVICE_ID_KEY]: newDeviceId});
                    }
                    resolve(newDeviceId);
                }
            });
        });
    },

    async registerDevice() {
        try {
            const version = CLIENT_RUNTIME.getManifest().version;
            const apiUrl = await getPopupApiUrl();
            const res = await fetch(`${apiUrl}/v2/extension/register`, {
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
            this.pendingState = stateParam;
            await StorageUtils.set({
                'oauth_state': stateParam,
                'auth_pending': true
            });

            const authHost = await getPopupAuthHost();
            const startUrl = `${authHost}/v2/faceit/start?device_id=${encodeURIComponent(this.deviceId)}&state=${stateParam}&json=true`;

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
                authUrl = `${authHost}/v2/faceit/start?state=${stateParam}&device_id=${encodeURIComponent(this.deviceId)}`;
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


    async verifySessionStatus() {
        try {
            if (!this.deviceId) return 'unknown';
            const apiUrl = await getPopupApiUrl();
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 3000);
            let res;
            try {
                res = await fetch(`${apiUrl}/v1/auth/session-status`, {
                    headers: {'X-Device-ID': this.deviceId},
                    signal: controller.signal
                });
            } finally {
                clearTimeout(timeout);
            }
            if (!res.ok) return 'unknown';
            const data = await res.json();
            if (typeof data.linked !== 'boolean') return 'unknown';
            try {
                CLIENT_API.storage.local.set({'forecast-auth-last-verified': Date.now()});
            } catch (e) {}
            return data.linked ? 'linked' : 'unlinked';
        } catch (e) {
            return 'unknown';
        }
    },

    async logout() {
        try {
            if (this.deviceId) {
                const apiUrl = await getPopupApiUrl();
                await fetch(`${apiUrl}/v1/auth/unlink?faceit_id=${this.state.user.playerId}`, {
                    method: 'POST',
                    headers: {'X-Device-ID': this.deviceId}
                });
            }
            await StorageUtils.set({
                [AUTH_STORAGE_KEY]: null,
                'auth_pending': false,
                'oauth_state': null,
                'auth_pending_timestamp': null
            });
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
                    <button id="logoutBtn" class="auth-btn auth-btn-logout">${t('logout', 'Logout')}</button>
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
                <div class="auth-controls">
                    <div class="info-tooltip-wrapper">
                        <div class="info-button" aria-label="Info">${UIBuilder.icon('info', 12, 12, 'info-icon')}</div>
                        <div class="info-tooltip auth-tooltip">
                            <div class="auth-tooltip-badge">
                                <img src="icons/rawlogo.svg" width="20" height="20" alt="">
                            </div>
                            <p data-i18n="auth_hint">${t('auth_hint')}</p>
                        </div>
                    </div>
                    <button id="loginBtn" class="${btnClass}">
                        <div class="auth-btn-icon">
                            <img src="icons/faceit.svg" class="faceit-icon" width="16" height="16" alt="">
                            <img src="icons/loading.svg" class="loading-icon" width="16" height="16" alt="">
                            <img src="icons/loaded.svg" class="success-icon" width="16" height="16" alt="">
                            <img src="icons/error.svg" class="error-icon" width="16" height="16" alt="">
                        </div>
                        ${t('login', 'Login')}
                    </button>
                </div>
            `;

            const loginBtn = document.getElementById('loginBtn');
            if (loginBtn && this.authState === 'idle') {
                loginBtn.addEventListener('click', () => this.login());
            }

            EventHandlers.setupTooltips(authSection);
        }
    },

    async loadAvatar(playerId) {
        try {
            const apiUrl = await getPopupApiUrl();
            const response = await fetch(`${apiUrl}/v1/faceit/avatar/${playerId}`);
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
    async _loadBundledConfig() {
        try {
            const url = CLIENT_RUNTIME.getURL('src/config/mappool.json');
            const response = await fetch(url);
            if (response.ok) return await response.json();
        } catch (e) {}
        return null;
    },

    async init() {
        try {
            mapsConfig = await this.fetchWithCache();
        } catch (error) {
            console.error('Failed to load maps config, using bundled:', error);
            mapsConfig = await this._loadBundledConfig() || { maps: {} };
        }
        CS2_MAPS = this.getActiveMaps();
        this.renderMapGrid();
    },

    async fetchWithCache() {
        let resolved = null;

        try {
            const cached = await StorageUtils.get([MAPS_CONFIG_CACHE_KEY, `${MAPS_CONFIG_CACHE_KEY}-time`]);
            const cachedData = cached[MAPS_CONFIG_CACHE_KEY];
            const cachedTime = cached[`${MAPS_CONFIG_CACHE_KEY}-time`];

            if (cachedData && cachedTime && (Date.now() - cachedTime < MAPS_CONFIG_CACHE_TTL)) {
                resolved = cachedData;
            }
        } catch (e) {
        }

        if (!resolved) {
            await _ensurePopupDomain();
            const cdnUrl = activeCdnUrl;
            let response;
            try {
                response = await fetch(`${cdnUrl}${MAPS_CONFIG_URL_PATH}?_=${Date.now()}`);
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
            } catch (e) {
                const fallbackCdn = cdnUrl === PRIMARY_CDN_URL ? FALLBACK_CDN_URL : PRIMARY_CDN_URL;
                response = await fetch(`${fallbackCdn}${MAPS_CONFIG_URL_PATH}?_=${Date.now()}`);
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
            }
            resolved = await response.json();

            try {
                await StorageUtils.set({
                    [MAPS_CONFIG_CACHE_KEY]: resolved,
                    [`${MAPS_CONFIG_CACHE_KEY}-time`]: Date.now()
                });
            } catch (e) {
            }
        }

        if (!resolved) {
            try {
                const cached = await StorageUtils.get([MAPS_CONFIG_CACHE_KEY]);
                if (cached[MAPS_CONFIG_CACHE_KEY]) resolved = cached[MAPS_CONFIG_CACHE_KEY];
            } catch (e) {}
        }

        const bundled = await this._loadBundledConfig();

        if (!resolved) return bundled || { maps: {} };

        if (bundled && typeof bundled.version === 'number' && (typeof resolved.version !== 'number' || bundled.version > resolved.version)) {
            return bundled;
        }

        return resolved;
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
                <img class="map-icon" src="${activeCdnUrl}/web/images/maps/${MAPS_ICONS_SIZE}/${mapData.icon}" alt="${mapData.display}">
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

const QuickPositionProfiles = {
    profiles: [],
    activeId: null,

    async init() {
        const { profiles, active } = await ensureQpsProfiles(CS2_MAPS);
        this.profiles = profiles;
        this.activeId = active;
        this.renderMenu();
        this.updateControls();
    },

    active() {
        return this.profiles.find(p => p.id === this.activeId) || this.profiles[0] || null;
    },

    async persist() {
        await StorageUtils.set({ [QPS_PROFILES_KEY]: this.profiles, [QPS_ACTIVE_KEY]: this.activeId });
    },

    renderMenu() {
        const label = document.getElementById('qpsProfileTriggerLabel');
        const active = this.active();
        if (label) label.textContent = active ? active.name : '';

        const menu = document.getElementById('qpsProfileMenu');
        if (!menu) return;
        menu.innerHTML = '';
        this.profiles.forEach(p => {
            const li = document.createElement('li');
            li.className = 'qps-profile-option' + (p.id === this.activeId ? ' active' : '');
            li.setAttribute('role', 'option');
            li.setAttribute('aria-selected', p.id === this.activeId ? 'true' : 'false');
            li.dataset.id = p.id;
            li.textContent = p.name;
            menu.appendChild(li);
        });
    },

    updateControls() {
        const addBtn = document.getElementById('qpsProfileAdd');
        const delBtn = document.getElementById('qpsProfileDelete');
        if (addBtn) addBtn.disabled = this.profiles.length >= QPS_MAX_PROFILES;
        if (delBtn) delBtn.disabled = this.profiles.length <= 1;
    },

    setMap(mapId, patch) {
        const profile = this.active();
        if (!profile) return Promise.resolve();
        if (!profile.maps) profile.maps = {};
        const entry = profile.maps[mapId] || { enabled: false, message: '' };
        profile.maps[mapId] = { ...entry, ...patch };
        return this.persist();
    },

    async switchTo(id) {
        if (!this.profiles.some(p => p.id === id)) return;
        this.activeId = id;
        await StorageUtils.set({ [QPS_ACTIVE_KEY]: id });
        this.renderMenu();
        SettingsManager.applyQuickPositionMaps();
    },

    async add() {
        if (this.profiles.length >= QPS_MAX_PROFILES) return;
        const id = 'p' + Date.now();
        const name = `${t('qps_profile_label', 'Profile')} ${this.profiles.length + 1}`;
        this.profiles.push({ id, name, maps: {} });
        this.activeId = id;
        await this.persist();
        this.renderMenu();
        this.updateControls();
        SettingsManager.applyQuickPositionMaps();
    },

    async remove() {
        if (this.profiles.length <= 1) return;
        this.profiles = this.profiles.filter(p => p.id !== this.activeId);
        this.activeId = this.profiles[0].id;
        await this.persist();
        this.renderMenu();
        this.updateControls();
        SettingsManager.applyQuickPositionMaps();
    },

    async rename(name) {
        const profile = this.active();
        if (!profile) return;
        const clean = (name || '').trim().slice(0, 24);
        if (!clean || clean === profile.name) return;
        profile.name = clean;
        await this.persist();
        this.renderMenu();
    }
};

const SettingsManager = {
    defaults: {
        isEnabled: true,
        sliderValue: 30,
        matchroom: true,
        teamMapWinrate: true,
        playerMapWinrate: true,
        showTeamElo: true,
        teamViewMode: 'radar',
        playerViewMode: 'radar',
        classicTeamView: false,
        classicPlayerView: false,
        eloranking: true,
        matchhistory: true,
        poscatcher: true,
        integrations: true,
        matchmakingData: true,
        matchmakingDataMode: 'both',
        matchCounter: true,
        coloredStatsKDA: true,
        coloredStatsADR: true,
        coloredStatsKD: true,
        showKR: true,
        coloredStatsKR: true,
        showFCR: true,
        coloredStatsFCR: true,
        showAVGElo: true,
        roundedStats: false
    },

    async load() {
        try {
            const keys = ['isEnabled', 'sliderValue', 'matchroom', 'teamMapWinrate', 'playerMapWinrate',
                'showTeamElo',
                'teamViewMode', 'playerViewMode', 'classicTeamView', 'classicPlayerView',
                'eloranking', 'matchhistory', 'poscatcher',
                'matchCounter', 'coloredStatsKDA', 'coloredStatsADR', 'coloredStatsKD',
                'showKR', 'coloredStatsKR', 'showFCR', 'coloredStatsFCR', 'showAVGElo', 'roundedStats',
                'matchmakingData', 'matchmakingDataMode',
                ...CS2_MAPS.flatMap(map => [`${map}Enabled`, `${map}Message`]), 'integrations'];

            const settings = await StorageUtils.get(keys);

            this.applySettings(settings);

            await QuickPositionProfiles.init();
            this.loadQuickPositionSettings(settings);

            this.loadMatchHistorySettings(settings);

            this.loadMatchroomSettings(settings);

            this.loadMatchmakingDataSettings(settings);

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
            integrations: 'integrations',
            matchmakingData: 'matchmakingData'
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
        this.updateDependentSettings('matchroom', ['#matchroomSettings'], matchroomEnabled);
    },

    loadQuickPositionSettings(settings) {
        const quickPositionToggle = document.getElementById('poscatcher');
        if (quickPositionToggle) {
            quickPositionToggle.checked = settings.poscatcher ?? this.defaults.poscatcher;
        }

        this.applyQuickPositionMaps();

        this.updateMapSettingsVisibility(quickPositionToggle?.checked ?? this.defaults.poscatcher);
    },

    applyQuickPositionMaps() {
        const profile = QuickPositionProfiles.active();
        const maps = (profile && profile.maps) ? profile.maps : {};

        CS2_MAPS.forEach(map => {
            const enabledToggle = document.getElementById(`${map}Enabled`);
            const messageInput = document.getElementById(`${map}Message`);
            const counter = document.getElementById(`${map}Counter`);
            const entry = maps[map] || { enabled: false, message: '' };

            if (enabledToggle) {
                enabledToggle.checked = entry.enabled === true;
                const mapCell = enabledToggle.closest('.map-cell');
                if (mapCell) mapCell.classList.toggle('enabled', entry.enabled === true);
            }

            if (messageInput) {
                messageInput.value = entry.message || '';
                if (counter) {
                    counter.textContent = `${messageInput.value.length}`;
                    UIUtils.updateCharCounter(counter, messageInput.value.length, 100);
                }
            }
        });
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
            showKR: 'showKR',
            coloredStatsKR: 'coloredStatsKR',
            coloredStatsFCR: 'coloredStatsFCR',
            showFCR: 'showFCR',
            showAVGElo: 'showAVGElo',
            roundedStats: 'roundedStats'
        };

        Object.entries(settingsElements).forEach(([elementId, settingKey]) => {
            const element = document.getElementById(elementId);
            if (element) {
                element.checked = settings[settingKey] ?? this.defaults[settingKey];
            }
        });

        const showKR = settings.showKR ?? this.defaults.showKR;
        this.updateKRColoredStatsVisibility(showKR);

        const showFCR = settings.showFCR ?? this.defaults.showFCR;
        this.updateFCRColoredStatsVisibility(showFCR);

        const matchHistoryEnabled = settings.matchhistory ?? this.defaults.matchhistory;
        this.updateDependentSettings('matchhistory', ['#matchHistorySettings'], matchHistoryEnabled);
    },

    loadMatchroomSettings(settings) {
        const matchroomToggle = document.getElementById('matchroom');
        if (matchroomToggle) {
            matchroomToggle.checked = settings.matchroom ?? this.defaults.matchroom;
        }

        const settingsElements = {
            teamMapWinrate: 'teamMapWinrate',
            playerMapWinrate: 'playerMapWinrate',
            showTeamElo: 'showTeamElo'
        };

        Object.entries(settingsElements).forEach(([elementId, settingKey]) => {
            const element = document.getElementById(elementId);
            if (element) {
                element.checked = settings[settingKey] ?? this.defaults[settingKey];
            }
        });

        const teamViewMode = settings.teamViewMode ?? (settings.classicTeamView ? 'classic' : this.defaults.teamViewMode);
        const teamViewRadio = document.querySelector(`#teamViewModeOptions input[value="${teamViewMode}"]`);
        if (teamViewRadio) teamViewRadio.checked = true;

        const playerViewMode = settings.playerViewMode ?? (settings.classicPlayerView ? 'classic' : this.defaults.playerViewMode);
        const playerViewRadio = document.querySelector(`#playerViewModeOptions input[value="${playerViewMode}"]`);
        if (playerViewRadio) playerViewRadio.checked = true;

        const matchroomEnabled = settings.matchroom ?? this.defaults.matchroom;
        this.updateDependentSettings('matchroom', ['#matchroomSettings'], matchroomEnabled);
    },

    updateFCRColoredStatsVisibility(isEnabled, animate = false) {
        if (animate) {
            this.animateGridCellToggle('fcrColoredStatsContainer', isEnabled);
        } else {
            const el = document.getElementById('fcrColoredStatsContainer');
            if (el) el.classList.toggle('hidden-cell', !isEnabled);
        }
    },

    updateKRColoredStatsVisibility(isEnabled, animate = false) {
        if (animate) {
            this.animateGridCellToggle('krColoredStatsContainer', isEnabled);
        } else {
            const el = document.getElementById('krColoredStatsContainer');
            if (el) el.classList.toggle('hidden-cell', !isEnabled);
        }
    },

    animateGridCellToggle(elementId, show) {
        const cell = document.getElementById(elementId);
        if (!cell) return;

        const grid = cell.closest('.settings-grid');
        if (!grid) {
            cell.classList.toggle('hidden-cell', !show);
            return;
        }

        const siblings = Array.from(grid.children).filter(s => s !== cell && !s.classList.contains('hidden-cell'));
        const firstPositions = new Map();
        siblings.forEach(s => firstPositions.set(s, s.getBoundingClientRect()));

        const flipSiblings = () => {
            requestAnimationFrame(() => {
                siblings.forEach(s => {
                    const first = firstPositions.get(s);
                    if (!first) return;
                    const last = s.getBoundingClientRect();
                    const dx = first.left - last.left;
                    const dy = first.top - last.top;
                    if (dx === 0 && dy === 0) return;
                    s.style.transition = 'none';
                    s.style.transform = `translate(${dx}px, ${dy}px)`;
                    requestAnimationFrame(() => {
                        s.style.transition = 'transform 0.3s ease';
                        s.style.transform = '';
                    });
                });
                setTimeout(() => {
                    siblings.forEach(s => { s.style.transition = ''; s.style.transform = ''; });
                }, 350);
            });
        };

        if (show) {
            cell.classList.remove('hidden-cell');
            cell.style.opacity = '0';
            cell.style.transform = 'scale(0.85)';
            flipSiblings();
            requestAnimationFrame(() => {
                cell.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
                cell.style.opacity = '';
                cell.style.transform = '';
                setTimeout(() => { cell.style.transition = ''; }, 350);
            });
        } else {
            cell.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
            cell.style.opacity = '0';
            cell.style.transform = 'scale(0.85)';
            setTimeout(() => {
                cell.classList.add('hidden-cell');
                cell.style.opacity = '';
                cell.style.transform = '';
                cell.style.transition = '';
                flipSiblings();
            }, 200);
        }
    },

    loadMatchmakingDataSettings(settings) {
        const toggle = document.getElementById('matchmakingData');
        if (toggle) {
            toggle.checked = settings.matchmakingData ?? this.defaults.matchmakingData;
        }
        const mode = settings.matchmakingDataMode ?? this.defaults.matchmakingDataMode;
        const radio = document.querySelector(`#matchmakingDataModeOptions input[name="matchmakingDataMode"][value="${mode}"]`);
        if (radio) radio.checked = true;
        const enabled = settings.matchmakingData ?? this.defaults.matchmakingData;
        this.updateDependentSettings('matchmakingData', ['#matchmakingDataSettings'], enabled);
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
            nestedId: 'matchHistorySettings'
        },
        {
            id: 'eloranking',
            labelKey: 'new_elo_rankings',
            descKey: 'new_elo_rankings_desc'
        },
        {
            id: 'matchroom',
            labelKey: 'advanced_matchroom',
            descKey: 'advanced_matchroom_desc',
            nestedId: 'matchroomSettings'
        },
        {
            id: 'matchmakingData',
            labelKey: 'mm_preview_feature',
            descKey: 'mm_preview_feature_desc',
            nestedId: 'matchmakingDataSettings'
        },
        {
            id: 'poscatcher',
            labelKey: 'quick_position_setup',
            descKey: 'quick_position_setup_desc',
            nestedId: 'mapSettings'
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
        {id: 'showKR', label: 'K/R', descKey: 'kr_desc', cellId: 'krSettingsCell'},
        {
            id: 'coloredStatsKR',
            labelKey: 'kr_color',
            descKey: 'kr_color_desc',
            className: 'hidden-cell',
            cellId: 'krColoredStatsContainer'
        },
        {id: 'showFCR', label: 'FCR', descKey: 'fcr_desc', cellId: 'fcrSettingsCell'},
        {
            id: 'coloredStatsFCR',
            labelKey: 'fcr_color',
            descKey: 'fcr_color_desc',
            className: 'hidden-cell',
            cellId: 'fcrColoredStatsContainer'
        },
        {id: 'showAVGElo', labelKey: 'avgelo', descKey: 'avgelo_desc', cellId: 'avgEloSettingsCell'},
        {id: 'roundedStats', labelKey: 'rounded_stats', descKey: 'rounded_stats_desc'}
    ],

    MATCHROOM_SETTINGS: [
        {id: 'teamMapWinrate', labelKey: 'team_map_winrate', descKey: 'team_map_winrate_desc'},
        {id: 'playerMapWinrate', labelKey: 'player_map_winrate', descKey: 'player_map_winrate_desc'},
        {id: 'showTeamElo', labelKey: 'show_team_elo', descKey: 'show_team_elo_desc'}
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

    createPillGroup(name, groupId, options) {
        const pills = options.map(([value, key]) =>
            `<label class="mm-mode-option"><input type="radio" name="${name}" value="${value}"><span class="mm-mode-pill" data-i18n="${key}">${t(key)}</span></label>`
        ).join('');
        return `<div class="mm-mode-options" id="${groupId}">${pills}</div>`;
    },

    createPillRow(labelKey, descKey, name, groupId, options) {
        return `<div class="setting-item mm-mode-row"><div class="setting-header"><label data-i18n="${labelKey}">${t(labelKey)}</label></div>`
            + `<div class="mm-mode-wrap">${this.createInfoTooltip(descKey, true)}${this.createPillGroup(name, groupId, options)}</div></div>`;
    },

    createMatchAmountRow() {
        return `<div class="setting-item"><div class="setting-header"><label for="rangeSlider" data-i18n="match_amount">${t('match_amount')}</label>${this.createInfoTooltip('match_amount_desc', true)}</div>`
            + `<div class="slider-controls"><input type="range" id="rangeSlider" class="range-slider" min="10" max="100" value="30"><span id="sliderValue">30</span></div></div>`;
    },

    nestedContentHtml(config) {
        if (!config.nestedId) return '';
        const viewModes = [['advanced', 'team_view_advanced'], ['classic', 'team_view_classic'], ['radar', 'team_view_radar']];
        let inner = '';
        switch (config.id) {
            case 'matchhistory':
                inner = '<div class="settings-grid" id="matchHistorySettingsGrid"></div>';
                break;
            case 'matchroom':
                inner = '<div class="settings-grid" id="matchroomSettingsGrid"></div>'
                    + this.createPillRow('team_view_mode', 'team_view_mode_desc', 'teamViewMode', 'teamViewModeOptions', viewModes)
                    + this.createPillRow('player_view_mode', 'player_view_mode_desc', 'playerViewMode', 'playerViewModeOptions', viewModes)
                    + this.createMatchAmountRow();
                break;
            case 'matchmakingData':
                inner = this.createPillRow('mm_preview_mode_label', 'mm_preview_mode_desc', 'matchmakingDataMode', 'matchmakingDataModeOptions',
                    [['both', 'mm_preview_mode_both'], ['servers', 'mm_preview_mode_servers'], ['maps', 'mm_preview_mode_maps']]);
                break;
            case 'poscatcher': {
                const renameSvg = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z"/></svg>';
                const addSvg = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>';
                const deleteSvg = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>';
                const chevronSvg = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>';
                inner = `<div class="qps-profile-bar">`
                    + `<div class="qps-profile-dropdown" id="qpsProfileDropdown">`
                    + `<button type="button" class="qps-profile-trigger" id="qpsProfileTrigger" aria-haspopup="listbox" aria-expanded="false" aria-label="${t('qps_profile_label', 'Profile')}"><span class="qps-profile-trigger-label" id="qpsProfileTriggerLabel"></span><span class="qps-profile-trigger-arrow">${chevronSvg}</span></button>`
                    + `<ul class="qps-profile-menu" id="qpsProfileMenu" role="listbox" hidden></ul>`
                    + `</div>`
                    + `<input type="text" class="qps-profile-name-input" id="qpsProfileNameInput" maxlength="24" hidden aria-label="${t('qps_profile_rename', 'Rename profile')}">`
                    + `<button type="button" class="qps-profile-btn" id="qpsProfileRename" title="${t('qps_profile_rename', 'Rename profile')}" aria-label="${t('qps_profile_rename', 'Rename profile')}">${renameSvg}</button>`
                    + `<button type="button" class="qps-profile-btn" id="qpsProfileAdd" title="${t('qps_profile_add', 'Add profile')}" aria-label="${t('qps_profile_add', 'Add profile')}">${addSvg}</button>`
                    + `<button type="button" class="qps-profile-btn" id="qpsProfileDelete" title="${t('qps_profile_delete', 'Delete profile')}" aria-label="${t('qps_profile_delete', 'Delete profile')}">${deleteSvg}</button>`
                    + `</div>`
                    + '<div class="map-grid"></div>';
                break;
            }
        }
        return `<div class="nested-setting visible" id="${config.nestedId}">${inner}</div>`;
    },

    createFeatureRow(config) {
        const hasDetail = !!config.nestedId;
        const chevron = hasDetail ? this.icon('chevron', 12, 12) : '';
        return `<div class="feature-row${hasDetail ? ' clickable' : ''}" data-id="${config.id}">`
            + `<div class="setting-header"><label data-i18n="${config.labelKey}">${t(config.labelKey)}</label></div>`
            + `<div class="feature-row-controls">${this.createInfoTooltip(config.descKey)}${this.createSwitch(config.id)}</div>`
            + `<span class="fr-chevron">${chevron}</span>`
            + `</div>`;
    },

    createFeatureDetail(config) {
        if (!config.nestedId) return '';
        return `<div class="feature-detail" data-feature="${config.id}" hidden>`
            + `<div class="feature-detail-head"><button type="button" class="feature-back">${this.icon('chevron', 14, 14)}<span data-i18n="back">${t('back', 'Back')}</span></button><span class="feature-detail-title" data-i18n="${config.labelKey}">${t(config.labelKey)}</span></div>`
            + this.nestedContentHtml(config)
            + `</div>`;
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

    buildMatchroomSettings() {
        const container = document.getElementById('matchroomSettingsGrid');
        if (!container) return;
        container.innerHTML = this.MATCHROOM_SETTINGS.map(s => this.createSettingsCell(s)).join('');
    },

    buildFeaturesSection() {
        const container = document.getElementById('featuresContainer');
        if (!container) return;
        const rows = this.FEATURES_CONFIG.map(c => this.createFeatureRow(c)).join('');
        const details = this.FEATURES_CONFIG.map(c => this.createFeatureDetail(c)).join('');
        container.innerHTML = `<div class="feature-list" id="featureList">${rows}</div><div class="feature-detail-host" id="featureDetailHost">${details}</div>`;
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

        const websiteUrl = _popupDomain === 'dev' ? 'https://fforecast.dev' : 'https://fforecast.net';
        html += `<div class="about-cell"><span class="about-cell-label" data-i18n="website">${t('website')}</span><a href="${websiteUrl}" target="_blank" class="about-button"><img src="icons/rawlogo.svg" alt="Website" style="width:30px;height:30px;margin:-2px"></a></div>`;

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
        this.buildMatchroomSettings();
        this.buildAboutSection();
        this.buildDonateSection();
    }
};

async function updateOnline() {
    let onlineElement = document.getElementById("online");
    if (onlineElement) {
        try {
            const apiUrl = await getPopupApiUrl();
            const res = await fetch(`${apiUrl}/v1/extension/online`);
            if (!res.ok) throw new Error(`Error on fetching online: ${res.statusText}`);
            let online = await res.json();
            const newValue = online.online;

            const currentValue = Number.parseInt(onlineElement.textContent) || 0;
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
        const toggles = ['toggleExtension', 'matchroom', 'eloranking', 'matchhistory', 'integrations', 'matchmakingData'];

        toggles.forEach(toggleId => {
            const element = document.getElementById(toggleId);
            if (!element) return;

            element.addEventListener('change', async function () {
                const key = toggleId === 'toggleExtension' ? 'isEnabled' : toggleId;
                await SettingsManager.save({[key]: this.checked});

                if (toggleId === 'matchroom') {
                    SettingsManager.updateDependentSettings('matchroom', ['#matchroomSettings'], this.checked);
                }

                if (toggleId === 'matchhistory') {
                    SettingsManager.updateDependentSettings('matchhistory', ['#matchHistorySettings'], this.checked);
                }

                if (toggleId === 'matchmakingData') {
                    SettingsManager.updateDependentSettings('matchmakingData', ['#matchmakingDataSettings'], this.checked);
                }
            });
        });

        document.querySelectorAll('#matchmakingDataModeOptions input[name="matchmakingDataMode"]').forEach(radio => {
            radio.addEventListener('change', async function () {
                if (this.checked) await SettingsManager.save({matchmakingDataMode: this.value});
            });
        });

        const rangeSlider = document.getElementById('rangeSlider');
        const sliderValueDisplay = document.getElementById('sliderValue');

        if (rangeSlider && sliderValueDisplay) {
            rangeSlider.addEventListener('change', function () {
                const slider = this;
                const from = Number.parseInt(slider.value, 10);
                const snapped = Math.min(100, Math.max(10, Math.round(from / 10) * 10));
                sliderValueDisplay.textContent = snapped;
                SettingsManager.save({sliderValue: snapped});
                const start = performance.now(), dur = 170;
                const animate = now => {
                    const tt = Math.min(1, (now - start) / dur), e = 1 - Math.pow(1 - tt, 3);
                    slider.value = Math.round(from + (snapped - from) * e);
                    if (tt < 1) requestAnimationFrame(animate);
                };
                requestAnimationFrame(animate);
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

    setupFeatureNav() {
        const list = document.getElementById('featureList');
        const host = document.getElementById('featureDetailHost');
        if (!list || !host) return;

        const main = document.querySelector('.main-content');
        const details = host.querySelectorAll('.feature-detail');

        const showList = () => {
            details.forEach(d => d.hidden = true);
            list.hidden = false;
            if (main) main.scrollTop = 0;
        };

        const showDetail = (id) => {
            const target = host.querySelector(`.feature-detail[data-feature="${id}"]`);
            if (!target) return;
            list.hidden = true;
            details.forEach(d => d.hidden = d !== target);
            if (main) main.scrollTop = 0;
        };

        list.querySelectorAll('.feature-row').forEach(row => {
            if (!host.querySelector(`.feature-detail[data-feature="${row.dataset.id}"]`)) return;
            row.addEventListener('click', (e) => {
                if (e.target.closest('.switch') || e.target.closest('.info-tooltip-wrapper')) return;
                showDetail(row.dataset.id);
            });
        });

        host.querySelectorAll('.feature-back').forEach(btn => btn.addEventListener('click', showList));

        const featuresTab = document.querySelector('.tab-button[data-tab="features"]');
        if (featuresTab) featuresTab.addEventListener('click', showList);

        showList();
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

        this.setupQuickPositionProfileBar();

        CS2_MAPS.forEach(map => {
            const enabledToggle = document.getElementById(`${map}Enabled`);
            if (enabledToggle) {
                const mapCell = enabledToggle.closest('.map-cell');

                if (mapCell && enabledToggle.checked) {
                    mapCell.classList.add('enabled');
                }

                enabledToggle.addEventListener('change', async function () {
                    await QuickPositionProfiles.setMap(map, { enabled: this.checked });
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
                    await QuickPositionProfiles.setMap(map, { message: this.value });
                });
            }
        });
    },

    setupQuickPositionProfileBar() {
        const dropdown = document.getElementById('qpsProfileDropdown');
        const trigger = document.getElementById('qpsProfileTrigger');
        const menu = document.getElementById('qpsProfileMenu');

        const onDocClick = (e) => {
            if (dropdown && !dropdown.contains(e.target)) closeMenu();
        };
        const closeMenu = () => {
            if (menu) menu.hidden = true;
            if (trigger) trigger.setAttribute('aria-expanded', 'false');
            document.removeEventListener('click', onDocClick);
        };
        const openMenu = () => {
            if (menu) menu.hidden = false;
            if (trigger) trigger.setAttribute('aria-expanded', 'true');
            document.addEventListener('click', onDocClick);
        };

        if (trigger && menu) {
            trigger.addEventListener('click', (e) => {
                e.stopPropagation();
                if (menu.hidden) openMenu(); else closeMenu();
            });
            menu.addEventListener('click', async (e) => {
                const option = e.target.closest('.qps-profile-option');
                if (!option) return;
                closeMenu();
                await QuickPositionProfiles.switchTo(option.dataset.id);
            });
            if (dropdown) {
                dropdown.addEventListener('keydown', (e) => {
                    if (e.key === 'Escape') closeMenu();
                });
            }
        }

        const addBtn = document.getElementById('qpsProfileAdd');
        if (addBtn) addBtn.addEventListener('click', () => QuickPositionProfiles.add());

        const deleteBtn = document.getElementById('qpsProfileDelete');
        if (deleteBtn) deleteBtn.addEventListener('click', () => QuickPositionProfiles.remove());

        const renameBtn = document.getElementById('qpsProfileRename');
        const nameInput = document.getElementById('qpsProfileNameInput');
        if (renameBtn && dropdown && nameInput) {
            const beginRename = () => {
                const profile = QuickPositionProfiles.active();
                if (!profile) return;
                closeMenu();
                nameInput.value = profile.name;
                dropdown.hidden = true;
                nameInput.hidden = false;
                nameInput.focus();
                nameInput.select();
            };
            const endRename = async (commit) => {
                if (nameInput.hidden) return;
                if (commit) await QuickPositionProfiles.rename(nameInput.value);
                nameInput.hidden = true;
                dropdown.hidden = false;
            };
            renameBtn.addEventListener('click', beginRename);
            nameInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') { e.preventDefault(); endRename(true); }
                else if (e.key === 'Escape') { e.preventDefault(); endRename(false); }
            });
            nameInput.addEventListener('blur', () => endRename(true));
        }
    },

    setupMatchHistoryEventListeners() {
        const settingsToggles = [
            'matchCounter',
            'coloredStatsKDA',
            'coloredStatsADR',
            'coloredStatsKD',
            'showKR',
            'coloredStatsKR',
            'showFCR',
            'coloredStatsFCR',
            'showAVGElo',
            'roundedStats'
        ];

        settingsToggles.forEach(toggleId => {
            const element = document.getElementById(toggleId);
            if (!element) return;

            element.addEventListener('change', async function () {
                await SettingsManager.save({[toggleId]: this.checked});

                if (toggleId === 'showKR') {
                    SettingsManager.updateKRColoredStatsVisibility(this.checked, true);
                }
                if (toggleId === 'showFCR') {
                    SettingsManager.updateFCRColoredStatsVisibility(this.checked, true);
                }
            });
        });
    },

    setupMatchroomEventListeners() {
        const settingsToggles = [
            'teamMapWinrate',
            'playerMapWinrate',
            'showTeamElo'
        ];

        settingsToggles.forEach(toggleId => {
            const element = document.getElementById(toggleId);
            if (!element) return;

            element.addEventListener('change', async function () {
                await SettingsManager.save({[toggleId]: this.checked});
            });
        });

        document.querySelectorAll('#teamViewModeOptions input[name="teamViewMode"]').forEach(radio => {
            radio.addEventListener('change', async function () {
                if (this.checked) await SettingsManager.save({teamViewMode: this.value});
            });
        });

        document.querySelectorAll('#playerViewModeOptions input[name="playerViewMode"]').forEach(radio => {
            radio.addEventListener('change', async function () {
                if (this.checked) await SettingsManager.save({playerViewMode: this.value});
            });
        });
    },

    setupTooltips(container = document) {
        const infoButtons = container.querySelectorAll('.info-button');

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
    if (PatchNotesManager.container) {
        PatchNotesManager.lang = currentLanguage;
        PatchNotesManager.loadedPages = 0;
        PatchNotesManager.loading = false;
        PatchNotesManager.loadFirstPage().catch(() => {});
    }
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

function initDebugBadge() {
    if (!isTest) return;

    const badge = document.createElement('div');
    badge.id = 'debug-domain-badge';
    badge.style.cssText = 'position:fixed;bottom:4px;left:4px;z-index:99999;font-size:10px;font-family:monospace;background:rgba(0,0,0,0.75);color:#0f0;padding:3px 6px;border-radius:4px;pointer-events:none;line-height:1.3;white-space:pre;';

    const update = async () => {
        const domain = _popupDomain || '(not resolved)';
        const urls = POPUP_DOMAIN_URLS[domain] || {};
        const api = urls.api || '(not resolved)';
        const auth = urls.auth || '(not resolved)';
        const cdn = activeCdnUrl || '(not resolved)';
        const isNet = domain === 'net';
        badge.style.color = isNet ? '#0f0' : '#ff0';
        badge.textContent = `API:  ${api}\nAUTH: ${auth}\nCDN:  ${cdn}`;
    };

    document.body.appendChild(badge);
    update();
    setInterval(update, 2000);
}


document.addEventListener("DOMContentLoaded", async () => {
    try {
        await initLanguage();

        UIBuilder.init();

        localizeDocument();

        await Promise.all([
            MapsConfigManager.init(),
            AuthManager.init(),
            UIUtils.loadManifestInfo()
        ]);

        await SettingsManager.load();

        UIUtils.setupTabs();

        EventHandlers.setupFeatureNav();

        UIUtils.startOnlineUpdater();

        EventHandlers.setupMainEventListeners();
        EventHandlers.setupQuickPositionEventListeners();
        EventHandlers.setupMatchHistoryEventListeners();
        EventHandlers.setupMatchroomEventListeners();
        EventHandlers.setupTooltips();
        setupLanguageSelector();

        initDebugBadge();
        PatchNotesManager.init().catch(err => console.error('Failed to init patch notes:', err));
    } catch (error) {
        console.error("Error during DOMContentLoaded:", error);
    }
});

CLIENT_RUNTIME.onMessage.addListener((message) => {
    if (message.type === 'auth_success') {
        if (AuthManager.pendingState && message.state && message.state !== AuthManager.pendingState) {
            console.warn('[Auth] Ignoring auth_success with mismatched state');
            return;
        }
        AuthManager.pendingState = null;
        AuthManager.handleAuthSuccess(message.user);
    } else if (message.type === 'auth_error') {
        AuthManager.pendingState = null;
        AuthManager.handleAuthError(message.error);
    } else if (message.type === 'transparent-bg') {
        document.body.style.backgroundColor = 'transparent'
    }
});

