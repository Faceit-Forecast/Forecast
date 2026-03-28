/*
 * Copyright (c) 2025 TerraMiner. All Rights Reserved.
 */

const DOMAIN_STORAGE_KEY = 'active_domain';
const DOMAIN_NET = 'net';
const DOMAIN_DEV = 'dev';

const DOMAIN_URLS = {
    net: {
        api: 'https://api.fforecast.net',
        auth: 'https://auth.fforecast.net',
        cdn: 'https://cdn.fforecast.net',
        site: 'https://fforecast.net'
    },
    dev: {
        api: 'https://api.fforecast.dev',
        auth: 'https://auth.fforecast.dev',
        cdn: 'https://cdn.fforecast.dev',
        site: 'https://fforecast.dev'
    }
};

let _cachedDomain = null;
let _domainResolvePromise = null;

async function getActiveDomain() {
    if (_cachedDomain) return _cachedDomain;

    if (_domainResolvePromise) return _domainResolvePromise;

    _domainResolvePromise = _resolveActiveDomain();
    const result = await _domainResolvePromise;
    _domainResolvePromise = null;
    return result;
}

async function _resolveActiveDomain() {
    try {
        const data = await new Promise((resolve) => {
            CLIENT_STORAGE.get([DOMAIN_STORAGE_KEY], (result) => {
                resolve(result[DOMAIN_STORAGE_KEY]);
            });
        });

        if (data) {
            _cachedDomain = data;
            return data;
        }
    } catch (e) {}

    try {
        const response = await CLIENT_RUNTIME.sendMessage({ type: 'GET_ACTIVE_DOMAIN' });
        if (response && response.domain) {
            _cachedDomain = response.domain;
            return response.domain;
        }
    } catch (e) {}

    return DOMAIN_NET;
}

async function getApiUrl() {
    const domain = await getActiveDomain();
    return DOMAIN_URLS[domain].api;
}

async function getAuthUrl() {
    const domain = await getActiveDomain();
    return DOMAIN_URLS[domain].auth;
}

async function getCdnUrl() {
    const domain = await getActiveDomain();
    return DOMAIN_URLS[domain].cdn;
}

async function getSiteUrl() {
    const domain = await getActiveDomain();
    return DOMAIN_URLS[domain].site;
}

function isUsingFallback() {
    return _cachedDomain === DOMAIN_DEV;
}

if (typeof CLIENT_API !== 'undefined') {
    CLIENT_API.storage.onChanged.addListener((changes, areaName) => {
        if (areaName === 'local' && changes[DOMAIN_STORAGE_KEY]) {
            _cachedDomain = changes[DOMAIN_STORAGE_KEY].newValue;
        }
    });
}
