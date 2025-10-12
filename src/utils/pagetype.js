class PageType {
    constructor(name, pattern) {
        this.name = name;
        this.pattern = pattern;
    }

    test(url) {
        return this.pattern.test(url);
    }
}

const STATS = new PageType(
    "stats",
    /^https:\/\/www\.faceit\.com\/[^\/]+\/players\/([^\/]+)\/stats\/([^\/]+)$/
);
const PROFILE = new PageType(
    "profile",
    /^https:\/\/www\.faceit\.com\/[^\/]+\/players\/([^\/]+)(\/.*)?$/
);
const MATCHROOM = new PageType(
    "matchroom",
    /^https:\/\/www\.faceit\.com\/[^\/]+\/[\w\-]+\/room\/[\w\-]+(\/.*)?$/
);
const MATCHMAKING = new PageType(
    "matchmaking",
    /^https:\/\/www\.faceit\.com\/[^\/]+\/matchmaking.*/
);
const PARTIES = new PageType(
    "parties",
    /^https:\/\/www\.faceit\.com\/[^\/]+\/(parties|club).*/
);

const pageTypes = [STATS, PROFILE, MATCHROOM, MATCHMAKING, PARTIES];

function defineUrlType(url) {
    for (const pageType of pageTypes) {
        if (pageType.test(url)) {
            return pageType.name;
        }
    }
    return null;
}
