/*
 * Copyright (c) 2025 TerraMiner. All Rights Reserved.
 */

class PageType {
    constructor(name, pattern) {
        this.name = name;
        this.pattern = pattern;
    }

    test(url) {
        return this.pattern.test(url);
    }

    extract(url) {
        return url.match(this.pattern);
    }
}

class Lobby {
    constructor(pageType, match) {
        this.pageType = pageType;
        this.gameType = null;
        this.lang = null;
        this.nickname = null;
        this._parse(pageType, match);
    }

    _parse(pageType, match) {
        if (!match) return;

        const fullInfo = ['stats', 'history', 'leagues', 'profile_game', 'tournaments'];
        const cs2Default = ['friends', 'videos', 'inventory', 'clubs', 'profile', 'teams'];
        const langOnly = ['home', 'matchroom', 'matchmaking', 'parties', 'club', 'team_leagues', 'team_stats', 'team_overview', 'settings_profile'];

        if (fullInfo.includes(pageType)) {
            this.lang = match[1];
            this.nickname = match[2];
            this.gameType = match[3];
        } else if (cs2Default.includes(pageType)) {
            this.lang = match[1];
            this.nickname = match[2];
            this.gameType = 'cs2';
        } else if (langOnly.includes(pageType)) {
            this.lang = match[1];
        }
    }
}

const STATS = new PageType(
    "stats",
    /^https:\/\/www\.faceit\.com\/([^/]+)\/players\/([^/]+)\/([^/]+)\/stats$/
);

const HISTORY = new PageType(
    "history",
    /^https:\/\/www\.faceit\.com\/([^/]+)\/players\/([^/]+)\/([^/]+)\/history$/
);

const LEAGUES = new PageType(
    "leagues",
    /^https:\/\/www\.faceit\.com\/([^/]+)\/players\/([^/]+)\/([^/]+)\/leagues$/
);

const TOURNAMENTS = new PageType(
    "tournaments",
    /^https:\/\/www\.faceit\.com\/([^/]+)\/players\/([^/]+)\/([^/]+)\/tournaments$/
);

const FRIENDS = new PageType(
    "friends",
    /^https:\/\/www\.faceit\.com\/([^/]+)\/players\/([^/]+)\/friends$/
);

const GUESTBOOK = new PageType(
    "friends",
    /^https:\/\/www\.faceit\.com\/([^/]+)\/players\/([^/]+)\/guestbook$/
);

const VIDEOS = new PageType(
    "videos",
    /^https:\/\/www\.faceit\.com\/([^/]+)\/players\/([^/]+)\/videos$/
);

const INVENTORY = new PageType(
    "inventory",
    /^https:\/\/www\.faceit\.com\/([^/]+)\/players\/([^/]+)\/inventory$/
);

const CLUBS = new PageType(
    "clubs",
    /^https:\/\/www\.faceit\.com\/([^/]+)\/players\/([^/]+)\/clubs$/
);

const TEAMS = new PageType(
    "teams",
    /^https:\/\/www\.faceit\.com\/([^/]+)\/players\/([^/]+)\/teams$/
);

const PROFILE_GAME = new PageType(
    "profile",
    /^https:\/\/www\.faceit\.com\/([^/]+)\/players\/([^/]+)\/([^/]+)$/
);

const PROFILE = new PageType(
    "profile",
    /^https:\/\/www\.faceit\.com\/([^/]+)\/players\/([^/]+)$/
);

const MATCHROOM = new PageType(
    "matchroom",
    /^https:\/\/www\.faceit\.com\/([^/]+)\/[\w-]+\/room\/([\w-]+)(\/.*)?$/
);

const MATCHMAKING = new PageType(
    "matchmaking",
    /^https:\/\/www\.faceit\.com\/([^/]+)\/matchmaking.*/
);

const PARTIES = new PageType(
    "parties",
    /^https:\/\/www\.faceit\.com\/([^/]+)\/parties.*/
);

const CLUB = new PageType(
    "club",
    /^https:\/\/www\.faceit\.com\/([^/]+)\/club.*/
);

const TEAM_LEAGUES = new PageType(
    "team_leagues",
    /^https:\/\/www\.faceit\.com\/([^/]+)\/teams\/([^/]+)\/leagues.*/
);

const TEAM_STATS = new PageType(
    "team_stats",
    /^https:\/\/www\.faceit\.com\/([^/]+)\/teams\/([^/]+)\/stats.*/
);

const TEAM_OVERVIEW = new PageType(
    "team_overview",
    /^https:\/\/www\.faceit\.com\/([^/]+)\/teams\/([^/]+)\/overview.*/
);

const HOME = new PageType(
    "home",
    /^https:\/\/www\.faceit\.com\/([^/]+)\/home.*/
);

const SETTINGS_PROFILE = new PageType(
    "settings_profile",
    /^https:\/\/www\.faceit\.com\/([^/]+)\/settings\/profile.*/
);

const UNKNOWN = new PageType(
    "unknown",
    /^https:\/\/www\.faceit\.com\/.*/
);


const pageTypes = [
    STATS,
    HISTORY,
    LEAGUES,
    TOURNAMENTS,
    FRIENDS,
    GUESTBOOK,
    VIDEOS,
    INVENTORY,
    CLUBS,
    TEAMS,
    PROFILE_GAME,
    MATCHROOM,
    MATCHMAKING,
    PARTIES,
    CLUB,
    TEAM_LEAGUES,
    TEAM_STATS,
    TEAM_OVERVIEW,
    PROFILE,
    HOME,
    SETTINGS_PROFILE,
    UNKNOWN
];

function defineLobby(url) {
    const cleanUrl = url.split('?')[0].split('#')[0];
    for (const pageType of pageTypes) {
        if (pageType.test(cleanUrl)) {
            const match = pageType.extract(cleanUrl);
            return new Lobby(pageType.name, match);
        }
    }
    return null;
}