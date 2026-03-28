/*
 * Copyright (c) 2025 TerraMiner. All Rights Reserved.
 */

const BROWSER_API = typeof browser !== 'undefined' ? browser : chrome;

const DOMAIN_STORAGE_KEY = 'active_domain';
const DOMAIN_NET = 'net';
const DOMAIN_DEV = 'dev';
const AUTH_STORAGE_KEY = 'forecast_auth';

const DOMAIN_URLS = {
    net: {
        api: 'https://api.fforecast.net',
        auth: 'https://auth.fforecast.net'
    },
    dev: {
        api: 'https://api.fforecast.dev',
        auth: 'https://auth.fforecast.dev'
    }
};

let _activeDomain = DOMAIN_NET;
let _domainCheckInterval = null;
const DOMAIN_CHECK_INTERVAL = 5 * 60 * 1000;

async function resolveDomain() {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3000);
        const res = await fetch(`${DOMAIN_URLS[DOMAIN_NET].api}/v2/extension/ping`, { signal: controller.signal });
        clearTimeout(timeout);
        if (res.ok) {
            await setActiveDomain(DOMAIN_NET);
            return;
        }
    } catch (e) {}

    await setActiveDomain(DOMAIN_DEV);
}

async function setActiveDomain(domain) {
    _activeDomain = domain;
    await new Promise((resolve) => {
        BROWSER_API.storage.local.set({ [DOMAIN_STORAGE_KEY]: domain }, resolve);
    });
}

function getAuthHost() {
    return DOMAIN_URLS[_activeDomain].auth;
}

function startDomainChecker() {
    if (_domainCheckInterval) clearInterval(_domainCheckInterval);
    resolveDomain();
    _domainCheckInterval = setInterval(resolveDomain, DOMAIN_CHECK_INTERVAL);
}

const activeSessions = new Map();

async function setStorage(items) {
    return new Promise((resolve) => {
        BROWSER_API.storage.sync.set(items, resolve);
    });
}

BROWSER_API.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'GET_ACTIVE_DOMAIN') {
        sendResponse({ domain: _activeDomain });
        return false;
    }

    if (message.type === 'START_AUTH') {
        handleStartAuth(message.data)
            .then(result => sendResponse(result))
            .catch(error => sendResponse({ success: false, error: error.message }));
        return true;
    }

    if (message.type === 'CHECK_AUTH_STATUS') {
        const status = getAuthStatus();
        sendResponse(status);
        return false;
    }

    if (message.type === 'CANCEL_AUTH') {
        cancelAuth(message.state);
        sendResponse({ success: true });
        return false;
    }
});

async function handleStartAuth(data) {
    const { authUrl, state, deviceId } = data;

    const tab = await BROWSER_API.tabs.create({ url: authUrl });

    activeSessions.set(state, {
        tabId: tab.id,
        state: state,
        deviceId: deviceId,
        startTime: Date.now(),
        attempts: 0,
        pollInterval: null
    });

    startPolling(state);

    return { success: true, state: state };
}

function startPolling(state) {
    const session = activeSessions.get(state);
    if (!session) return;

    const MAX_ATTEMPTS = 60;
    const POLL_INTERVAL = 5000;

    session.pollInterval = setInterval(async () => {
        session.attempts++;

        if (session.attempts > MAX_ATTEMPTS) {
            await handleAuthFailure(state, 'Authentication timeout');
            return;
        }

        try {
            await BROWSER_API.tabs.get(session.tabId);
        } catch (e) {
            await handleAuthFailure(state, 'Authentication cancelled');
            return;
        }

        try {
            const authHost = getAuthHost();
            const response = await fetch(`${authHost}/v2/verify?state=${state}`);

            if (!response.ok) {
                return;
            }

            const data = await response.json();

            if (data.success && data.user) {
                await handleAuthSuccess(state, data.user);
            }
        } catch (error) {
            console.debug('[Background] Polling error:', error.message);
        }
    }, POLL_INTERVAL);
}

async function handleAuthSuccess(state, user) {
    const session = activeSessions.get(state);
    if (!session) return;

    if (session.pollInterval) {
        clearInterval(session.pollInterval);
        session.pollInterval = null;
    }

    try {
        await BROWSER_API.tabs.remove(session.tabId);
    } catch (e) {
        console.warn('Could not close auth tab:', e);
    }

    await setStorage({
        [AUTH_STORAGE_KEY]: {
            user: user,
            expiresAt: Date.now() + (7 * 24 * 60 * 60 * 1000)
        },
        'auth_pending': false,
        'oauth_state': null
    });

    activeSessions.delete(state);

    try {
        await BROWSER_API.runtime.sendMessage({
            type: 'auth_success',
            user: user
        });
    } catch (e) {
        console.debug('[Background] Could not notify popup (probably closed):', e.message);
    }
}

async function handleAuthFailure(state, error) {
    const session = activeSessions.get(state);
    if (!session) return;

    if (session.pollInterval) {
        clearInterval(session.pollInterval);
        session.pollInterval = null;
    }

    try {
        await BROWSER_API.tabs.remove(session.tabId);
    } catch (e) {
        console.debug('[Background] Auth tab already closed');
    }

    await setStorage({
        'auth_pending': false,
        'oauth_state': null
    });

    activeSessions.delete(state);

    try {
        await BROWSER_API.runtime.sendMessage({
            type: 'auth_error',
            error: error
        });
    } catch (e) {
        console.debug('[Background] Could not notify popup:', e.message);
    }
}

function cancelAuth(state) {
    const session = activeSessions.get(state);
    if (!session) return;

    if (session.pollInterval) {
        clearInterval(session.pollInterval);
        session.pollInterval = null;
    }

    activeSessions.delete(state);
}

function getAuthStatus() {
    return {
        hasPendingSessions: activeSessions.size > 0,
        sessions: Array.from(activeSessions.keys())
    };
}

BROWSER_API.runtime.onStartup.addListener(() => {
    activeSessions.clear();
    setStorage({ 'auth_pending': false });
    startDomainChecker();
});

BROWSER_API.runtime.onInstalled.addListener(() => {
    activeSessions.clear();
    setStorage({ 'auth_pending': false });
    startDomainChecker();
});

startDomainChecker();
