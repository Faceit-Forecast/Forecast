/*
 * Copyright (c) 2025 TerraMiner. All Rights Reserved.
 */

const FC_MM_CONTAINER_CLASS = 'fc-mm-panel';
const FC_MM_MODE_KEY = 'matchmakingDataMode';
const FC_MM_MODE_DEFAULT = 'both';

let fcMmLastData = null;
let fcMmListenerInstalled = false;
let fcMmCurrentMode = FC_MM_MODE_DEFAULT;

function fcMmFormatMapName(raw) {
    const name = String(raw || '').replace(/^de_/, '');
    if (!name) return '';
    return name.charAt(0).toUpperCase() + name.slice(1);
}

function fcMmFlagImg(server) {
    if (!server.flag) return null;
    const img = document.createElement('img');
    img.className = 'fc-mm-flag';
    img.src = server.flag;
    img.alt = '';
    img.loading = 'lazy';
    return img;
}

async function fcMmAttachMapIcon(imgEl, mapName) {
    try {
        const url = await getMapIconUrl(mapName);
        if (url && imgEl.isConnected) imgEl.src = url;
    } catch (_) {}
}

function fcMmCreateMapImage(mapName) {
    const img = document.createElement('img');
    img.alt = fcMmFormatMapName(mapName);
    img.loading = 'lazy';
    img.src = '';
    fcMmAttachMapIcon(img, mapName);
    return img;
}

function fcMmExtractServers(payload, tags) {
    const candidates = [payload.locations, payload.servers, payload.serverLocations];
    for (const c of candidates) {
        if (!Array.isArray(c) || !c.length) continue;
        const list = c
            .map(l => {
                if (typeof l === 'string') return { name: l, flag: '' };
                return {
                    name: (l && (l.class_name || l.name || l.guid)) || '',
                    flag: (l && (l.image_sm || l.image_lg)) || ''
                };
            })
            .filter(s => s.name);
        if (list.length) return list;
    }

    return tags
        .filter(t => typeof t === 'string' && /^[A-Z][A-Za-z ]+$/.test(t))
        .map(name => ({ name, flag: '' }));
}

function fcMmExtract(payload) {
    if (!payload || typeof payload !== 'object') return null;

    const tags = Array.isArray(payload.tags) ? payload.tags : [];
    const servers = fcMmExtractServers(payload, tags);

    const maps = [];
    for (const tag of tags) {
        if (typeof tag !== 'string' || !tag.includes('de_')) continue;
        for (const item of tag.split(',')) {
            const v = item.trim();
            if (v.startsWith('de_')) maps.push(v);
        }
        break;
    }
    maps.sort((a, b) => fcMmFormatMapName(a).localeCompare(fcMmFormatMapName(b)));

    if (!servers.length && !maps.length) return null;

    return {
        servers,
        maps,
        phase: payload.state || payload.status || null
    };
}

function fcMmIsPreMatchPhase(phase) {
    if (!phase) return true;
    const s = String(phase).toUpperCase();
    return s === 'CHECK_IN' || s === 'VOTING' || s === 'CONFIGURING' || s === 'READY';
}

function fcMmEmpty() {
    const el = document.createElement('div');
    el.className = 'fc-mm-empty';
    el.textContent = '—';
    return el;
}

function fcMmRenderServersBlock(data) {
    const block = document.createElement('div');
    block.className = 'fc-mm-servers-side';

    const label = document.createElement('span');
    label.className = 'fc-mm-section-label';
    label.textContent = t('mm_servers', 'Servers');
    block.appendChild(label);
    if (!data.servers.length) {
        block.appendChild(fcMmEmpty());
        return block;
    }
    for (const s of data.servers) {
        const item = document.createElement('div');
        item.className = 'fc-mm-server';
        const flag = fcMmFlagImg(s);
        if (flag) item.appendChild(flag);
        const name = document.createElement('span');
        name.className = 'fc-mm-server-name';
        name.textContent = s.name;
        item.appendChild(name);
        block.appendChild(item);
    }
    return block;
}

function fcMmRenderMapsBlock(data) {
    const block = document.createElement('div');
    block.className = 'fc-mm-maps-block';

    const label = document.createElement('span');
    label.className = 'fc-mm-section-label';
    label.textContent = t('mm_maps', 'Maps');
    block.appendChild(label);

    const grid = document.createElement('div');
    grid.className = 'fc-mm-maps-grid';
    if (!data.maps.length) {
        grid.appendChild(fcMmEmpty());
    } else {
        for (const m of data.maps) {
            const pill = document.createElement('div');
            pill.className = 'fc-mm-map-pill';
            pill.appendChild(fcMmCreateMapImage(m));
            const name = document.createElement('span');
            name.className = 'fc-mm-map-pill-name';
            name.textContent = fcMmFormatMapName(m);
            pill.appendChild(name);
            grid.appendChild(pill);
        }
    }
    block.appendChild(grid);
    return block;
}

function fcMmRenderBody(body, data, mode) {
    body.replaceChildren();
    body.removeAttribute('data-mode');
    body.setAttribute('data-mode', mode);

    if (mode === 'servers') {
        body.appendChild(fcMmRenderServersBlock(data));
        return;
    }
    if (mode === 'maps') {
        body.appendChild(fcMmRenderMapsBlock(data));
        return;
    }
    body.appendChild(fcMmRenderServersBlock(data));
    const divider = document.createElement('div');
    divider.className = 'fc-mm-side-divider';
    body.appendChild(divider);
    body.appendChild(fcMmRenderMapsBlock(data));
}

function fcMmBuildContainer(data, mode) {
    const tpl = MATCHMAKING_PREVIEW_TEMPLATE.cloneNode(true);
    const root = tpl.firstElementChild;

    setupBrandIcon(tpl, 24, 24);
    localizeHtmlResource(tpl);

    const body = root.querySelector('.fc-mm-body');
    fcMmRenderBody(body, data, mode);

    return root;
}

function fcMmFindAnchor() {
    const dialog = document.querySelector(sel('matchmakingModal.dialog'));
    if (!dialog) return null;
    const anchorSel = sel('matchmakingModal.anchor');
    const anchor = anchorSel ? dialog.querySelector(anchorSel) : null;
    return { dialog, anchor };
}

function fcMmRemoveExisting() {
    document.querySelectorAll(`.${FC_MM_CONTAINER_CLASS}`).forEach(n => n.remove());
}

function fcMmTryInject(data) {
    if (!data) return;
    if (document.querySelector(`.${FC_MM_CONTAINER_CLASS}`)) return;
    const found = fcMmFindAnchor();
    if (!found) return;
    const container = fcMmBuildContainer(data, fcMmCurrentMode);
    if (found.anchor) {
        found.anchor.insertAdjacentElement('afterend', container);
    } else {
        found.dialog.appendChild(container);
    }
    matchmakingDataModule.removalNode(container);
}

function fcMmHandlePayload(ev) {
    try {
        const raw = ev?.detail?.data;
        const payload = raw?.payload;
        if (!payload) return;

        const phase = payload.state || payload.status;
        if (!fcMmIsPreMatchPhase(phase)) {
            fcMmLastData = null;
            return;
        }

        const data = fcMmExtract(payload);
        if (!data) return;

        fcMmLastData = data;

        const existing = document.querySelector(`.${FC_MM_CONTAINER_CLASS}`);
        if (existing && existing.parentElement) {
            const fresh = fcMmBuildContainer(data, fcMmCurrentMode);
            existing.parentElement.replaceChild(fresh, existing);
            matchmakingDataModule.removalNode(fresh);
            return;
        }

        fcMmTryInject(data);
    } catch (e) {
        error('mm handler failed', e);
    }
}

async function fcMmLoadMode() {
    try {
        const stored = await CLIENT_STORAGE_SYNC.get([FC_MM_MODE_KEY]);
        const mode = stored?.[FC_MM_MODE_KEY];
        fcMmCurrentMode = (mode === 'servers' || mode === 'maps' || mode === 'both') ? mode : FC_MM_MODE_DEFAULT;
    } catch (_) {
        fcMmCurrentMode = FC_MM_MODE_DEFAULT;
    }
}

function fcMmHandleStorageChange(changes, area) {
    if (area !== 'sync') return;
    if (!changes || !(FC_MM_MODE_KEY in changes)) return;
    const next = changes[FC_MM_MODE_KEY].newValue;
    fcMmCurrentMode = (next === 'servers' || next === 'maps' || next === 'both') ? next : FC_MM_MODE_DEFAULT;
    if (fcMmLastData) {
        const existing = document.querySelector(`.${FC_MM_CONTAINER_CLASS}`);
        if (existing && existing.parentElement) {
            const fresh = fcMmBuildContainer(fcMmLastData, fcMmCurrentMode);
            existing.parentElement.replaceChild(fresh, existing);
            matchmakingDataModule.removalNode(fresh);
        }
    }
}

const matchmakingDataModule = new Module("matchmakingData", async () => {
    await fcMmLoadMode();

    if (!fcMmListenerInstalled) {
        document.addEventListener('forecast:matchPayload', fcMmHandlePayload);
        try { CLIENT_API.storage.onChanged.addListener(fcMmHandleStorageChange); } catch (_) {}
        fcMmListenerInstalled = true;
    }

    matchmakingDataModule.doAfterNodeAppear(sel('matchmakingModal.dialog'), () => {
        if (fcMmLastData) fcMmTryInject(fcMmLastData);
    });

    matchmakingDataModule.doAfterNodeDisappear(sel('matchmakingModal.dialog'), () => {
        fcMmLastData = null;
        fcMmRemoveExisting();
    });
}, async () => {
    fcMmLastData = null;
});

