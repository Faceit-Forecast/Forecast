/*
 * Copyright (c) 2025 TerraMiner. All Rights Reserved.
 */

const REPUTATION_TOXIC = 'toxic';
const REPUTATION_FRIENDLY = 'friendly';
const REPUTATION_NEUTRAL = 'neutral';
const REPUTATION_STORAGE_KEY = 'player_reputation';

async function getPlayerReputation(playerId) {
    try {
        const result = await CLIENT_STORAGE.get([REPUTATION_STORAGE_KEY]);
        const data = result[REPUTATION_STORAGE_KEY] || {};
        const entry = data[playerId];
        if (!entry) return null;
        return { rating: entry.rating, updatedAt: entry.updatedAt, meetCount: entry.meetCount || 0 };
    } catch (e) {
        error('getPlayerReputation failed', e);
        return null;
    }
}

async function setPlayerReputation(playerId, rating) {
    try {
        const result = await CLIENT_STORAGE.get([REPUTATION_STORAGE_KEY]);
        const data = result[REPUTATION_STORAGE_KEY] || {};
        const existing = data[playerId] || {};
        data[playerId] = { rating, updatedAt: Date.now(), meetCount: existing.meetCount || 0 };
        await CLIENT_STORAGE.set({ [REPUTATION_STORAGE_KEY]: data });
    } catch (e) {
        error('setPlayerReputation failed', e);
    }
}

async function incrementMeetCount(playerId) {
    try {
        const result = await CLIENT_STORAGE.get([REPUTATION_STORAGE_KEY]);
        const data = result[REPUTATION_STORAGE_KEY] || {};
        const entry = data[playerId] || { rating: REPUTATION_NEUTRAL, updatedAt: 0, meetCount: 0 };
        entry.meetCount = (entry.meetCount || 0) + 1;
        if (!data[playerId]) data[playerId] = { rating: REPUTATION_NEUTRAL, updatedAt: 0, meetCount: 0 };
        data[playerId] = { ...data[playerId], meetCount: entry.meetCount };
        await CLIENT_STORAGE.set({ [REPUTATION_STORAGE_KEY]: data });
    } catch (e) {
        error('incrementMeetCount failed', e);
    }
}

async function resetPlayerReputation(playerId) {
    try {
        const result = await CLIENT_STORAGE.get([REPUTATION_STORAGE_KEY]);
        const data = result[REPUTATION_STORAGE_KEY] || {};
        const existing = data[playerId];
        if (!existing) return;
        const meetCount = existing.meetCount || 0;
        data[playerId] = { rating: REPUTATION_NEUTRAL, updatedAt: Date.now(), meetCount };
        await CLIENT_STORAGE.set({ [REPUTATION_STORAGE_KEY]: data });
    } catch (e) {
        error('resetPlayerReputation failed', e);
    }
}

async function getAllReputations() {
    try {
        const result = await CLIENT_STORAGE.get([REPUTATION_STORAGE_KEY]);
        return result[REPUTATION_STORAGE_KEY] || {};
    } catch (e) {
        error('getAllReputations failed', e);
        return {};
    }
}
