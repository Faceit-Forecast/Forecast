/*
 * Copyright (c) 2025 TerraMiner. All Rights Reserved.
 */

class ObserveHandler {
    constructor() {
        this.observerAppearTasks = new Map();
        this.observerDisappearTasks = new Map();
        this.observer = null
    }

    register() {
        this.observer = new MutationObserver(mutationsList => {
            for (const mutation of mutationsList) {
                if (mutation.type === 'childList') {
                    for (const node of mutation.addedNodes) {
                        this.observerAppearTasks.forEach(async (task, _) => {
                            await task(node)
                        })
                    }
                    for (const node of mutation.removedNodes) {
                        this.observerDisappearTasks.forEach(async (task, _) => {
                            await task(node)
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

    async doAfterNodeDisappear(selector, callback, id){
        this.observeDisappear(id ? id : selector, async (node) => {
            if (node.matches && node.matches(selector)) {
                callback(node)
                this.releaseAppearTask(id ? id : selector)
            }
        })
    }

    async doAfterNodeAppear(selector, callback, id) {
        let element = document.querySelector(selector);
        if (element) await callback(element);

        this.observeAppear(id ? id : selector, async (node) => {
            if (node.matches && node.matches(selector)) {
                await callback(node);
            } else if (node.nodeType === 1) {
                const matchingChildren = node.querySelectorAll(selector);
                for (const child of matchingChildren) {
                    await callback(child);
                }
            }
        });
    }
    async doAfterNodeAppearWithCondition(selector, conditionFn, callback, id) {
        let element = document.querySelector(selector);
        if (element && conditionFn(element)) await callback(element);

        this.observeAppear(id ? id : selector, async (node) => {
            if (node.matches && node.matches(selector) && conditionFn(node)) {
                await callback(node);
            } else if (node.nodeType === 1) {
                const matchingChildren = node.querySelectorAll(selector);
                for (const child of matchingChildren) {
                    if (conditionFn(child))
                    await callback(child);
                }
            }
        });
    }


    async doAfterAllNodeAppear(selector, callback, id) {
        let elements = document.querySelectorAll(selector);
        if (elements.length !== 0) {
            for (const element of elements) {
                await callback(element);
            }
        }

        this.observeAppear(id ? id : selector, async (node) => {
            if (node.matches && node.matches(selector)) {
                await callback(node);
            }

            if (node.nodeType === 1) {
                const matchingChildren = node.querySelectorAll(selector);
                for (const child of matchingChildren) {
                    await callback(child);
                }
            }
        });
    }

    async doAfterAllNodeAppearPack(selector, callback, id) {
        let elements = document.querySelectorAll(selector);
        if (elements.length !== 0) await callback(elements);

        this.observeAppear(id ? id : selector, async () => {
            let elements = document.querySelectorAll(selector);
            if (elements.length !== 0) await callback(elements);
        });
    }

    release() {
        this.observerAppearTasks.clear();
        this.observerDisappearTasks.clear();
        this.observer?.disconnect()
    }

}