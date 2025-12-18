/*
 * Copyright (c) 2025 TerraMiner. All Rights Reserved.
 */

class ObserveHandler {
    constructor() {
        this.observerAppearTasks = new Map();
        this.observerDisappearTasks = new Map();
        this.observer = null;
        this.isRegistered = false;
    }

    register() {
        if (this.isRegistered) return
        this.isRegistered = true
        this.observer = new MutationObserver(mutationsList => {
            for (const mutation of mutationsList) {
                if (mutation.type === 'childList') {
                    for (const node of mutation.addedNodes) {
                        this.observerAppearTasks.forEach(async (task, _) => {
                            try {
                                await task(node)
                            } catch (e) {
                                error(e)
                            }
                        })
                    }
                    for (const node of mutation.removedNodes) {
                        this.observerDisappearTasks.forEach(async (task, _) => {
                            try {
                                await task(node)
                            } catch (e) {
                                error(e)
                            }
                        })
                    }
                }
            }
        });

        this.observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    observeAppear(id, task) {
        this.observerAppearTasks.set(id, task)
    }

    observeDisappear(id, task) {
        this.observerDisappearTasks.set(id, task)
    }

    releaseAppearTask(id) {
        this.observerAppearTasks.delete(id)
    }

    releaseDisappearTask(id) {
        this.observerDisappearTasks.delete(id)
    }

    async doAfterNodeDisappear(selector, callback, id) {
        this.observeDisappear(id || selector, async (node) => {
            if (node.matches?.(selector)) {
                callback(node)
                this.releaseAppearTask(id || selector)
            }
        })
    }

    async doAfterNodeAppear(selector, callback, id) {
        this.observeAppear(id || selector, async (node) => {
            if (node.matches?.(selector)) {
                await callback(node);
            } else if (node.nodeType === 1) {
                const matchingChildren = node.querySelectorAll(selector);
                for (const child of matchingChildren) {
                    await callback(child);
                }
            }
        });

        let element = document.querySelector(selector);
        if (element) {
            await callback(element);
        }
    }

    async doAfterNodeAppearWithCondition(selector, conditionFn, callback, id) {
        this.observeAppear(id || selector, async (node) => {
            if (node.matches?.(selector) && conditionFn(node)) {
                await callback(node);
            } else if (node.nodeType === 1) {
                const matchingChildren = node.querySelectorAll(selector);
                for (const child of matchingChildren) {
                    if (conditionFn(child))
                        await callback(child);
                }
            }
        });

        let element = document.querySelector(selector);
        if (element && conditionFn(element)) {
            await callback(element);
        }
    }


    async doAfterAllNodeAppear(selector, callback, id) {
        this.observeAppear(id || selector, async (node) => {
            if (node.matches?.(selector)) {
                await callback(node);
            }

            if (node.nodeType === 1) {
                for (const element of node.querySelectorAll(selector)) {
                    await callback(element);
                }
            }
        });

        let elements = document.querySelectorAll(selector);
        if (elements.length !== 0) {
            for (const element of elements) {
                await callback(element);
            }
        }
    }

    async doAfterAllNodeAppearPack(selector, callback, id) {
        this.observeAppear(id || selector, async () => {
            let elements = document.querySelectorAll(selector);
            if (elements.length !== 0) await callback(elements);
        });

        let elements = document.querySelectorAll(selector);

        if (elements.length !== 0) {
            await callback(elements);
        }
    }

    release() {
        if (!this.isRegistered) return
        this.isRegistered = false
        this.observerAppearTasks.clear();
        this.observerDisappearTasks.clear();
        this.observer?.disconnect()
    }

}