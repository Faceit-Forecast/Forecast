/*
 * Copyright (c) 2025 TerraMiner. All Rights Reserved.
 */
(() => {
    const MATCH_RE = /\/api\/match\/v2\/match\/[^/?#]+/;

    const isMatchUrl = (url) => {
        try { return MATCH_RE.test(String(url)); } catch (_) { return false; }
    };

    const dispatchPayload = (url, data) => {
        try {
            document.dispatchEvent(new CustomEvent('forecast:matchPayload', {
                detail: { url: String(url), data }
            }));
        } catch (_) {}
    };

    const origFetch = window.fetch;
    if (typeof origFetch === 'function') {
        window.fetch = function patchedFetch(input) {
            const url = typeof input === 'string' ? input : (input && input.url);
            const promise = origFetch.apply(this, arguments);
            if (isMatchUrl(url)) {
                promise.then(async (response) => {
                    try {
                        const ct = response.headers.get('content-type') || '';
                        if (!ct.includes('application/json')) return;
                        const data = await response.clone().json();
                        dispatchPayload(url, data);
                    } catch (_) {}
                }).catch(() => {});
            }
            return promise;
        };
    }

    const origOpen = XMLHttpRequest.prototype.open;
    const origSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function (method, url) {
        this.__forecastUrl = url;
        return origOpen.apply(this, arguments);
    };

    XMLHttpRequest.prototype.send = function () {
        const url = this.__forecastUrl;
        if (isMatchUrl(url)) {
            this.addEventListener('load', () => {
                try {
                    const ct = (this.getResponseHeader && this.getResponseHeader('content-type')) || '';
                    if (!ct.includes('application/json')) return;
                    const data = JSON.parse(this.responseText);
                    dispatchPayload(url, data);
                } catch (_) {}
            });
        }
        return origSend.apply(this, arguments);
    };
})();
