/*
 * Copyright (c) 2025 TerraMiner. All Rights Reserved.
 */

const customLevelsBatchCache = new Map();
const CUSTOM_LEVELS_TTL_MS = 5 * 60 * 1000;

async function fetchCustomLevels(playerIds) {
    const out = new Map();
    if (!Array.isArray(playerIds) || playerIds.length === 0) return out;

    const now = Date.now();
    const idsToFetch = [];
    const seen = new Set();

    for (const id of playerIds) {
        if (!id || seen.has(id)) continue;
        seen.add(id);

        const cached = customLevelsBatchCache.get(id);
        if (cached && (now - cached.fetchedAt) < CUSTOM_LEVELS_TTL_MS) {
            if (cached.value) out.set(id, cached.value);
        } else {
            idsToFetch.push(id);
        }
    }

    if (idsToFetch.length === 0) return out;

    try {
        const baseUrl = await getBaseUrlFC();
        const CHUNK = 100;
        for (let i = 0; i < idsToFetch.length; i += CHUNK) {
            const chunk = idsToFetch.slice(i, i + CHUNK);
            const data = await fetchFC(`${baseUrl}/v1/auth/custom-levels/lookup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ playerIds: chunk })
            });

            const levels = (data && data.levels) ? data.levels : {};
            const fetchedAt = Date.now();

            for (const id of chunk) {
                const v = levels[id] || null;
                customLevelsBatchCache.set(id, { value: v, fetchedAt });
                if (v) out.set(id, v);
            }
        }
    } catch (e) {
    }

    return out;
}

const customLevelsModule = new Module("custom-levels", async () => {
    const matchId = extractMatchId();
    if (!matchId) return;

    let nicknameToIdMap = null;
    let customLevels = null;
    let matchStatsPromise = null;

    const ensureData = async () => {
        if (customLevels !== null) return;
        if (!matchStatsPromise) {
            matchStatsPromise = (async () => {
                const matchDetails = await fetchMatchStats(matchId);
                if (!matchDetails || !matchDetails.teams) return;

                const map = new Map();
                const ids = [];
                for (const factionKey of ["faction1", "faction2"]) {
                    const faction = matchDetails.teams[factionKey];
                    if (!faction || !Array.isArray(faction.roster)) continue;
                    for (const player of faction.roster) {
                        if (player && player.nickname && player.player_id) {
                            map.set(player.nickname, player.player_id);
                            ids.push(player.player_id);
                        }
                    }
                }
                nicknameToIdMap = map;
                customLevels = await fetchCustomLevels(ids);
            })();
        }
        await matchStatsPromise;
    };

    const findRowWithLevelIcon = (startNode) => {
        let cur = startNode;
        for (let i = 0; i < 6 && cur; i++) {
            if (cur.querySelector && cur.querySelector('[id*=lvlicon]')) return cur;
            cur = cur.parentElement;
        }
        return null;
    };

    const applyCustomLevelToRow = (row, level) => {
        if (!row) return;
        const marker = `fc-custom-level`;
        if (row.getAttribute(`data-${marker}`) === level) return;

        const icons = row.querySelectorAll('[id*=lvlicon]');
        if (!icons.length) return;

        for (const oldIcon of icons) {
            const newWrapper = getLevelIcon(level);
            if (!newWrapper || !newWrapper.firstChild) continue;
            const newIcon = newWrapper.firstChild;
            if (oldIcon.id) newIcon.id = oldIcon.id;
            const oldSpan = oldIcon.tagName === 'SPAN' ? oldIcon : oldIcon.querySelector('span');
            const newSpan = newIcon.tagName === 'SPAN' ? newIcon : newIcon.querySelector('span');
            if (oldSpan && newSpan) {
                if (oldSpan.style.width) newSpan.style.width = oldSpan.style.width;
                if (oldSpan.style.height) newSpan.style.height = oldSpan.style.height;
            }
            oldIcon.replaceWith(newIcon);
            customLevelsModule.removalNode(newIcon);
        }
        row.setAttribute(`data-${marker}`, level);
    };

    const handleMatchPlayerNode = async (node) => {
        await ensureData();
        if (!nicknameToIdMap || !customLevels || customLevels.size === 0) return;

        const nickname = node.textContent;
        if (!nickname) return;
        const playerId = nicknameToIdMap.get(nickname);
        if (!playerId) return;
        const level = customLevels.get(playerId);
        if (!level) return;

        await customLevelsModule.doAfterAsync(
            () => findRowWithLevelIcon(node),
            (row) => applyCustomLevelToRow(row, level),
            150
        );
    };

    const selectorMatchPlayer = sel('profiles.matchPlayer');
    customLevelsModule.doAfterAllNodeAppearWhenVisible(selectorMatchPlayer, handleMatchPlayerNode);
});
