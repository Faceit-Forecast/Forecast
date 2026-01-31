/*
 * Copyright (c) 2025 TerraMiner. All Rights Reserved.
 */

const BROWSER_API = typeof browser !== 'undefined' ? browser : chrome;

const AUTH_HOST = 'https://auth.fforecast.net';
const AUTH_STORAGE_KEY = 'forecast_auth';

const activeSessions = new Map();

async function setStorage(items) {
    return new Promise((resolve) => {
        BROWSER_API.storage.sync.set(items, resolve);
    });
}

BROWSER_API.runtime.onMessage.addListener((message, sender, sendResponse) => {
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
            const response = await fetch(`${AUTH_HOST}/verify?state=${state}`);

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
});

BROWSER_API.runtime.onInstalled.addListener(() => {
    activeSessions.clear();
    setStorage({ 'auth_pending': false });
});