/*
 * Copyright (c) 2025 TerraMiner. All Rights Reserved.
 */

const bansModule = new Module("bans", async () => {
    bansModule.temporaryFaceitBugFix();
    const settings = await getSettings({
        sliderValue: 30
    });

    const selectorBansContentWrapper = sel('bans.bansContentWrapper');
    bansModule.doAfterNodeAppear(selectorBansContentWrapper, async (node) => {
        if (bansModule.isProcessedNode(node)) return;
        bansModule.processedNode(node);

        const mount = createTableMount(settings.sliderValue);
        node.appendChild(mount.root);
        bansModule.removalNode(mount.root);

        const loadingLabel = t('loading', 'Loading...');
        mount.status.textContent = loadingLabel;

        try {
            const currentNick = extractPlayerNick();
            if (!currentNick) {
                mount.status.textContent = t('temporarily_unavailable', 'Temporarily unavailable');
                return;
            }

            const rows = await loadBansRows(currentNick, settings.sliderValue, (done, total) => {
                if (total > 0) {
                    mount.status.textContent = `${loadingLabel} ${done}/${total}`;
                } else {
                    mount.status.textContent = loadingLabel;
                }
            });

            if (rows.length === 0) {
                mount.status.textContent = t('not_found', 'Not found');
                return;
            }

            mount.status.remove();
            mount.root.appendChild(buildBansTable(rows));
        } catch (e) {
            error('Failed to build bans table', e);
            mount.status.textContent = t('temporarily_unavailable', 'Temporarily unavailable');
        }
    });
});

function createTableMount(matchesAmount) {
    ensureBansStyles();

    const root = BANS_CARD_TEMPLATE.cloneNode(true).firstChild;
    const title = root.querySelector('.fc-bans-title');
    title.textContent = t('bans_menu_header', 'Banned players') + ' ' + t('bans_loading_last_matches', 'for the last {0} matches').replace('{0}', matchesAmount);
    const status = root.querySelector('.fc-bans-status');

    return { root, status };
}

function ensureBansStyles() {
    if (document.getElementById('fc-bans-style')) return;

    const style = BANS_STYLES_TEMPLATE.cloneNode(true).firstChild;
    document.head.appendChild(style);
}

async function loadBansRows(currentNickname, matchesAmount, onProgress = null) {
    const currentPlayer = await fetchPlayerStatsByNickName(currentNickname);
    if (!currentPlayer?.player_id) return [];

    const playerMatches = await fetchV4PlayerMatches(currentPlayer.player_id, matchesAmount);
    if (!playerMatches?.items?.length) return [];

    const candidates = collectBanCandidates(playerMatches.items, currentPlayer.player_id);
    const progress = typeof onProgress === 'function' ? onProgress : null;
    const total = candidates.length;
    let done = 0;

    if (progress) {
        progress(0, total);
    }

    const rows = [];

    await Promise.all(candidates.map(async (candidate) => {
        try {
            const bansResponse = await fetchV4PlayerBans(candidate.playerId);
            const ban = extractLatestBan(bansResponse);
            if (!ban) return;

            rows.push({
                nickname: candidate.nickname || '-',
                reason: ban.reason || ban.ban_reason || '-',
                banDate: formatBanDate(ban.starts_at || ban.start_date || ban.created_at),
                unbanDate: formatBanDate(ban.ends_at || ban.end_date || ban.expires_at),
                banTs: Date.parse(ban.starts_at || ban.start_date || ban.created_at || 0) || 0,
                matchId: candidate.matchId
            });
        } finally {
            done += 1;
            if (progress) {
                progress(done, total);
            }
        }
    }));

    rows.sort((a, b) => b.banTs - a.banTs);
    return rows;
}

function collectBanCandidates(matches, currentPlayerId) {
    const candidates = [];
    const seenPlayers = new Set();

    for (const match of matches) {
        const matchId = match?.match_id;
        const matchTs = match?.finished_at;
        const teams = match?.teams || {};

        for (const team of Object.values(teams)) {
            const players = Array.isArray(team?.players) ? team.players : [];

            for (const player of players) {
                const playerId = player?.player_id;
                if (!playerId || playerId === currentPlayerId) continue;
                if (seenPlayers.has(playerId)) continue;

                seenPlayers.add(playerId);
                candidates.push({
                    matchId,
                    matchTs,
                    playerId,
                    nickname: player.nickname || '-'
                });
            }
        }
    }

    return candidates;
}

function extractLatestBan(response) {
    let bans = [];

    if (Array.isArray(response)) {
        bans = response;
    } else if (Array.isArray(response?.items)) {
        bans = response.items;
    } else if (Array.isArray(response?.bans)) {
        bans = response.bans;
    } else if (response && typeof response === 'object' && (response.reason || response.starts_at || response.ends_at)) {
        bans = [response];
    }

    if (!bans.length) return null;

    let latest = null;
    let maxDate = 0;
    for (const ban of bans) {
        const date = Date.parse(ban?.starts_at || 0) || 0;
        if (date > maxDate) {
            maxDate = date;
            latest = ban;
        }
    }
    return latest;
}

function formatBanDate(value) {
    if (!value) return '-';
    const parsed = Date.parse(value);
    if (Number.isNaN(parsed)) return String(value);

    const lang = extractLanguage() || 'en';
    return new Date(parsed).toLocaleString(lang, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function buildBansTable(rows) {
    const wrap = document.createElement('div');
    wrap.className = 'fc-bans-table-wrap';

    const table = document.createElement('table');
    table.className = 'fc-bans-table';

    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    [
        t('player_nickname', 'Player nickname'),
        t('ban_reason', 'Ban reason'),
        t('ban_date', 'Ban date'),
        t('unban_date', 'Unban date'),
        t('match', 'Match')
    ].forEach((label) => {
        const th = document.createElement('th');
        th.textContent = label;
        headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);

    const tbody = document.createElement('tbody');
    rows.forEach((row) => {
        const tr = document.createElement('tr');

        tr.appendChild(createPlayerCell(row.nickname));
        tr.appendChild(createCell(row.reason));
        tr.appendChild(createCell(row.banDate));
        tr.appendChild(createCell(row.unbanDate));
        tr.appendChild(createMatchCell(row.matchId));

        tbody.appendChild(tr);
    });

    table.appendChild(thead);
    table.appendChild(tbody);
    wrap.appendChild(table);
    return wrap;
}

function createCell(value) {
    const td = document.createElement('td');
    td.textContent = value || '-';
    if (!value || value === '-') td.classList.add('fc-bans-empty');
    return td;
}

function createPlayerCell(nickname) {
    const td = document.createElement('td');
    if (!nickname) {
        td.textContent = '-';
        td.classList.add('fc-bans-empty');
        return td;
    }

    const link = document.createElement('a');
    const lang = extractLanguage() || 'en';
    link.href = `https://www.faceit.com/${lang}/players/${encodeURIComponent(nickname)}`;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.className = 'fc-bans-player-link';
    link.textContent = nickname;

    td.appendChild(link);
    return td;
}

function createMatchCell(matchId) {
    const td = document.createElement('td');
    if (!matchId) {
        td.textContent = '-';
        td.classList.add('fc-bans-empty');
        return td;
    }

    const link = document.createElement('a');
    const lang = extractLanguage() || 'en';
    link.href = `https://www.faceit.com/${lang}/cs2/room/${matchId}`;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.className = 'fc-bans-link';
    link.textContent = t('open_match', 'Open match');

    td.appendChild(link);
    return td;
}

