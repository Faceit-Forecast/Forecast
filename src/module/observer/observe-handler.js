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

        this.visibilityObservers = new Map();
        this.visibilityCallbackKey = Symbol('__visibilityCallbacks');

        this.visibilityObserver = this.#getVisibilityObserver({ threshold: 0 });
    }

    #visibilityObserverKey(options) {
        const threshold = options && options.threshold != null ? options.threshold : 0;
        const rootMargin = options && options.rootMargin != null ? options.rootMargin : '0px';
        return `${rootMargin}|${threshold}`;
    }

    #getVisibilityObserver(options) {
        const key = this.#visibilityObserverKey(options);
        const existing = this.visibilityObservers.get(key);
        if (existing) return existing;

        const self = this;
        const observer = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    if (!entry.isIntersecting) continue;

                    const callbacks = entry.target[self.visibilityCallbackKey];
                    let cb = null;
                    if (callbacks) {
                        cb = callbacks.get(key);
                        if (cb) {
                            callbacks.delete(key);
                            if (callbacks.size === 0) {
                                delete entry.target[self.visibilityCallbackKey];
                            }
                        }
                    }

                    observer.unobserve(entry.target);

                    if (cb) {
                        try {
                            cb(entry.target);
                        } catch (e) {
                            error(e);
                        }
                    }
                }
            },
            {
                threshold: options && options.threshold != null ? options.threshold : 0,
                rootMargin: options && options.rootMargin != null ? options.rootMargin : '0px'
            }
        );

        this.visibilityObservers.set(key, observer);
        return observer;
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

    doWhenVisible(element, callback, options) {
        if (!element) return;

        const opts = options || {};
        const rootMargin = opts.rootMargin || '0px';
        let marginTop = 0, marginBottom = 0;
        const parts = rootMargin.trim().split(/\s+/).map(p => parseInt(p, 10) || 0);
        if (parts.length === 1)      { marginTop = marginBottom = parts[0]; }
        else if (parts.length === 2) { marginTop = marginBottom = parts[0]; }
        else if (parts.length >= 3)  { marginTop = parts[0]; marginBottom = parts[2] ?? parts[0]; }
        const rect = element.getBoundingClientRect();
        const isVisible =
            rect.bottom > -marginTop &&
            rect.top < window.innerHeight + marginBottom &&
            rect.right > 0 &&
            rect.left < window.innerWidth;

        if (isVisible) {
            callback(element);
            return;
        }

        const key = this.#visibilityObserverKey(opts);
        let callbacks = element[this.visibilityCallbackKey];
        if (!callbacks) {
            callbacks = new Map();
            element[this.visibilityCallbackKey] = callbacks;
        }
        if (callbacks.has(key)) return;
        callbacks.set(key, callback);

        const observer = this.#getVisibilityObserver(opts);
        observer.observe(element);
    }

    unobserveVisibility(element, options) {
        if (!element) return;
        const key = this.#visibilityObserverKey(options || {});
        const observer = this.visibilityObservers.get(key);
        if (observer) observer.unobserve(element);

        const callbacks = element[this.visibilityCallbackKey];
        if (callbacks) {
            callbacks.delete(key);
            if (callbacks.size === 0) delete element[this.visibilityCallbackKey];
        }
    }

    async doAfterNodeDisappear(selector, callback, id) {
        if (!selector) return;
        this.observeDisappear(id || selector, async (node) => {
            if (node.matches?.(selector)) {
                callback(node)
                this.releaseDisappearTask(id || selector)
            }
        })
    }

    async doAfterElementDisappear(element, callback, id) {
        const key = id || element;
        this.observeDisappear(key, async (node) => {
            if (node === element || node.contains?.(element)) {
                callback(node)
                this.releaseDisappearTask(key)
            }
        })
    }

    async doAfterNodeAppear(selector, callback, id) {
        if (!selector) return;
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
        if (!selector) return;
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
        if (!selector) return;
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
        if (!selector) return;
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
        if (!selector) return;
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
        if (!selector) return;
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
        this.visibilityObservers.forEach(observer => {
            try { observer.disconnect(); } catch (_) {}
        });
        this.visibilityObservers.clear();
        this.visibilityObserver = this.#getVisibilityObserver({ threshold: 0 });
    }
}