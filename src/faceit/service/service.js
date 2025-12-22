/*
 * Copyright (c) 2025 TerraMiner. All Rights Reserved.
 */

const serviceModule = new Module("service", async () => {
    await fetchPing();
    serviceModule.every(1000 * 60 * 2, async () => {
        await fetchPing();
    });
}, async () => {});