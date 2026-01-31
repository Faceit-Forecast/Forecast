/*
 * Copyright (c) 2025 TerraMiner. All Rights Reserved.
 */

class ObserveHandler {
    constructor() {
        this.observerAppearTasks = new Map();
        this.observerDisappearTasks = new Map();
        this.selectorTasks = new Map();
        this.observer = null;
        this.isRegistered = false;
        this.recheckScheduled = false;

        this.visibilityObserver = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    if (!entry.isIntersecting) continue;

                    const callback = entry.target.__visibilityCallback;
                    if (callback) {
                        callback(entry.target);
                        delete entry.target.__visibilityCallback;
                    }

                    this.visibilityObserver.unobserve(entry.target);
                }
            },
            { threshold: 0 }
        );
    }

    register() {
        if (this.isRegistered) return
        this.isRegistered = true

        this.observer = new MutationObserver(mutationsList => {
            let hasRelevantChanges = false;

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
                    hasRelevantChanges = true;
                } else if (mutation.type === 'characterData' || mutation.type === 'attributes') {
                    hasRelevantChanges = true;
                }
            }

            if (hasRelevantChanges) {
                this.scheduleRecheck();
            }
        });

        this.observer.observe(document.body, {
            childList: true,
            subtree: true,
            characterData: true,
            characterDataOldValue: false
        });
    }

    scheduleRecheck() {
        if (this.recheckScheduled) return;
        this.recheckScheduled = true;

        queueMicrotask(() => {
            this.recheckScheduled = false;
            this.recheckSelectors();
        });
    }

    recheckSelectors() {
        this.selectorTasks.forEach(async (taskInfo, _key) => {
            try {
                const elements = document.querySelectorAll(taskInfo.selector);
                for (const element of elements) {
                    if (!taskInfo.processedElements.has(element)) {
                        taskInfo.processedElements.add(element);
                        await taskInfo.callback(element);
                    }
                }
            } catch (e) {
                error(e);
            }
        });
    }

    registerSelectorTask(selector, callback, id) {
        const key = id || selector;
        if (!this.selectorTasks.has(key)) {
            this.selectorTasks.set(key, {
                selector: selector,
                callback: callback,
                processedElements: new WeakSet()
            });
        }
        return this.selectorTasks.get(key);
    }

    releaseSelectorTask(id) {
        this.selectorTasks.delete(id);
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

    doWhenVisible(element, callback) {
        if (!element) return;

        const rect = element.getBoundingClientRect();
        const isVisible =
            rect.bottom > 0 &&
            rect.top < window.innerHeight &&
            rect.right > 0 &&
            rect.left < window.innerWidth;

        if (isVisible) {
            callback(element);
            return;
        }

        element.__visibilityCallback = callback;
        this.visibilityObserver.observe(element);
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

    async doAfterNodeAppearWhenVisible(selector, callback, id) {
        this.observeAppear(id || selector, async (node) => {
            if (node.matches?.(selector)) {
                this.doWhenVisible(node, callback);
            } else if (node.nodeType === 1) {
                const matchingChildren = node.querySelectorAll(selector);
                for (const child of matchingChildren) {
                    this.doWhenVisible(child, callback);
                }
            }
        });

        let element = document.querySelector(selector);
        if (element) {
            this.doWhenVisible(element, callback);
        }
    }

    async doAfterAllNodeAppear(selector, callback, id) {
        const taskInfo = this.registerSelectorTask(selector, callback, id);

        this.observeAppear(id || selector, async (node) => {
            if (node.nodeType === 1) {
                if (node.matches?.(selector)) {
                    if (!taskInfo.processedElements.has(node)) {
                        taskInfo.processedElements.add(node);
                        await callback(node);
                    }
                }
                for (const element of node.querySelectorAll(selector)) {
                    if (!taskInfo.processedElements.has(element)) {
                        taskInfo.processedElements.add(element);
                        await callback(element);
                    }
                }
            }
        });

        let elements = document.querySelectorAll(selector);
        for (const element of elements) {
            if (!taskInfo.processedElements.has(element)) {
                taskInfo.processedElements.add(element);
                await callback(element);
            }
        }
    }

    async doAfterAllNodeAppearWhenVisible(selector, callback, id) {
        const taskInfo = this.registerSelectorTask(selector, callback, id);

        this.observeAppear(id || selector, async (node) => {
            if (node.nodeType === 1) {
                if (node.matches?.(selector)) {
                    if (!taskInfo.processedElements.has(node)) {
                        taskInfo.processedElements.add(node);
                        this.doWhenVisible(node, callback);
                    }
                }
                for (const element of node.querySelectorAll(selector)) {
                    if (!taskInfo.processedElements.has(element)) {
                        taskInfo.processedElements.add(element);
                        this.doWhenVisible(element, callback);
                    }
                }
            }
        });

        let elements = document.querySelectorAll(selector);
        for (const element of elements) {
            if (!taskInfo.processedElements.has(element)) {
                taskInfo.processedElements.add(element);
                this.doWhenVisible(element, callback);
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
        this.selectorTasks.clear();
        this.observer?.disconnect()
        this.visibilityObserver?.disconnect()
    }
}