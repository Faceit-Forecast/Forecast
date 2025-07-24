/*
 * Copyright (c) 2025 TerraMiner. All Rights Reserved.
 */

class Module {
    constructor(name, loadAction, unloadAction = () => {
    }) {
        this.name = name
        this.loadAction = loadAction;
        this.unloadAction = unloadAction;
        this.isLoaded = false;
        this.processedNodes = [];
        this.nodesToRemove = [];
        this.hidedNodes = [];
        this.tasks = [];
        this.observeHandler = new ObserveHandler();
    }

    async #load() {
        if (this.isLoaded) return
        println(`Module ${this.name} is loading`);
        this.#generateSessionId();
        this.observeHandler.register();
        await this.loadAction();
        this.isLoaded = true
        println(`Module ${this.name} is successfully loaded`);
    }

    async #reload() {
        println(`Module ${this.name} is reloading`);
        await this.unloadAction();
        this.#releaseCaches();
        this.isLoaded = false
        this.#generateSessionId();
        this.observeHandler.register();
        await this.loadAction();
        this.isLoaded = true
        println(`Module ${this.name} is successfully reloaded`);
    }

    async #unload() {
        if (!this.isLoaded) return
        println(`Module ${this.name} is disabling`);
        await this.unloadAction();
        this.#releaseCaches();
        this.isLoaded = false
        println(`Module ${this.name} is successfully disabled`);
    }

    #generateSessionId() {
        this.sessionId = Math.random().toString(36).substring(2, 10);
        this.dataProcessedAttribute = `data-processed-${this.sessionId}`
    }

    #releaseCaches() {
        requestAnimationFrame(() => {
            this.observeHandler.release();

            this.processedNodes.forEach((node) => {
                node?.removeAttribute(this.dataProcessedAttribute)
            });
            this.processedNodes.length = 0;

            for (let i = 0; i < this.nodesToRemove.length; i++) {
                let node = this.nodesToRemove[i];
                node?.remove();
            }
            this.nodesToRemove.length = 0;

            this.hidedNodes.forEach((node) => {
                node?.style?.removeProperty('display')
            });
            this.hidedNodes.length = 0

            this.tasks.forEach((task) => {
                clearInterval(task)
            })
            this.tasks.length = 0
        });
    }

    processedNode(node) {
        this.processedNodes.push(node)
        node.setAttribute(this.dataProcessedAttribute, '')
    }

    isProcessedNode(node) {
        return node.hasAttribute(this.dataProcessedAttribute)
    }

    removalNode(node) {
        this.nodesToRemove.push(node)
    }

    appendToAndHide(sourceNode, hiddenNode) {
        appendToAndHide(sourceNode, hiddenNode)
        this.hidedNodes.push(hiddenNode)
    }

    preppendToAndHide(sourceNode, hiddenNode) {
        preppendToAndHide(sourceNode, hiddenNode)
        this.hidedNodes.push(hiddenNode)
    }

    async doAfterNodeDisappear(selector, callback, id) {
        return this.observeHandler.doAfterNodeDisappear(selector,callback, id)
    }
    async doAfterNodeAppear(selector, callback, id) {
        return this.observeHandler.doAfterNodeAppear(selector,callback, id)
    }

    async doAfterNodeAppearWithCondition(selector, conditionFn, callback, id) {
        return this.observeHandler.doAfterNodeAppearWithCondition(selector,conditionFn,callback, id)
    }

    async doAfterAllNodeAppear(selector, callback, id) {
        return this.observeHandler.doAfterAllNodeAppear(selector,callback, id)
    }
    async doAfterAllNodeAppearPack(selector, callback, id) {
        return this.observeHandler.doAfterAllNodeAppearPack(selector,callback, id)
    }

    async doAfterAsync(conditionFn, callback, interval = 50) {
        let isRunning = true;
        let task;

        const checkCondition = async () => {
            if (!isRunning) return;

            const conditionResult = await conditionFn();
            if (conditionResult) {
                isRunning = false;
                if (task) task();
                await callback(conditionResult);
            }
        };

        await checkCondition();

        task = this.every(interval, checkCondition);

        return () => {
            isRunning = false;
            if (task) task();
        };
    }

    doAfter(conditionFn, callback, interval = 50) {
        let isRunning = true;
        let task;

        const checkCondition = () => {
            if (!isRunning) return;

            const conditionResult = conditionFn();
            if (conditionResult) {
                isRunning = false;
                if (task) task();
                callback(conditionResult);
            }
        };

        checkCondition();

        task = this.every(interval, checkCondition);

        return () => {
            isRunning = false;
            if (task) task();
        };
    }

    every(period, callback) {
        const task = setInterval(callback, period)
        this.tasks.push(task)
        return () => clearInterval(task)
    }

    async produceOf(action) {
        switch (action) {
            case "load":
                await this.#load();
                break;
            case "reload":
                await this.#reload();
                break;
            case "unload":
                await this.#unload();
                break;
            default:
                println("Unknown action:", action);
        }
    }

    temporaryFaceitBugFix() {
        let existDialog = document.querySelector('[marked-as-bug]');
        if (existDialog) {
            if (!document.querySelector('[role="dialog"][data-dialog-type="LEAF"]')) {
                existDialog.removeAttribute("marked-as-bug")
            } else {
                this.doAfterNodeDisappear('[role="dialog"][data-dialog-type="LEAF"]', (node) => {
                    existDialog.removeAttribute("marked-as-bug")
                })
            }
            return
        }
        this.doAfterNodeAppear('[role="dialog"][data-dialog-type="LEAF"]', () => {
            let toMark = document.getElementById("canvas-body");
            if (toMark.hasAttribute("marked-as-bug")) return
            toMark.setAttribute("marked-as-bug",'');
        });
    }
}