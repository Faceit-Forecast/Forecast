/*
 * Copyright (c) 2025 TerraMiner. All Rights Reserved.
 */

const I18N_SUPPORTED_LANGUAGES = ['en', 'ru', 'de', 'fr', 'uk', 'pl'];
const I18N_DEFAULT_LANGUAGE = 'en';

const I18N_LANGUAGE_NAMES = {
    en: "English",
    ru: "Русский",
    de: "Deutsch",
    fr: "Français",
    uk: "Українська",
    pl: "Polski"
};

let i18nCurrentLanguage = I18N_DEFAULT_LANGUAGE;
let i18nTranslations = {};
let isI18nLoaded = false;

const i18nModule = new Module("i18n", async () => {
    if (isI18nLoaded) return;
    await initI18nLanguage();
    await loadTranslations(i18nCurrentLanguage);
    isI18nLoaded = true;
    println(`i18n loaded: language=${i18nCurrentLanguage}, translations loaded=${Object.keys(i18nTranslations).join(', ')}`);
});

async function initI18nLanguage() {
    try {
        const lang = await getSettingValue('language', null);
        if (lang && I18N_SUPPORTED_LANGUAGES.includes(lang)) {
            i18nCurrentLanguage = lang;
        } else {
            i18nCurrentLanguage = detectI18nBrowserLanguage();
        }
    } catch (e) {
        i18nCurrentLanguage = detectI18nBrowserLanguage();
    }
}

function detectI18nBrowserLanguage() {
    const browserLang = navigator.language?.split('-')[0] || navigator.userLanguage?.split('-')[0];
    return I18N_SUPPORTED_LANGUAGES.includes(browserLang) ? browserLang : I18N_DEFAULT_LANGUAGE;
}

async function loadTranslations(lang) {
    try {
        const url = CLIENT_RUNTIME.getURL(`_locales/${lang}/forecast.json`);
        const response = await fetch(url);
        if (response.ok) {
            i18nTranslations[lang] = await response.json();
        }
    } catch (e) {
        error("Failed to load translations for " + lang, e);
    }

    if (lang !== I18N_DEFAULT_LANGUAGE && !i18nTranslations[I18N_DEFAULT_LANGUAGE]) {
        try {
            const fallbackUrl = CLIENT_RUNTIME.getURL(`_locales/${I18N_DEFAULT_LANGUAGE}/forecast.json`);
            const fallbackResponse = await fetch(fallbackUrl);
            if (fallbackResponse.ok) {
                i18nTranslations[I18N_DEFAULT_LANGUAGE] = await fallbackResponse.json();
            }
        } catch (e) {
            error("Failed to load fallback translations", e);
        }
    }
}

function t(key, fallback = null) {
    if (!isI18nLoaded) {
        println(`i18n: t() called before i18n loaded, key=${key}`);
        return fallback !== null ? fallback : key;
    }

    const langTranslations = i18nTranslations[i18nCurrentLanguage];
    const result = langTranslations?.[key];

    if (result !== undefined) {
        return result;
    }

    if (i18nCurrentLanguage !== I18N_DEFAULT_LANGUAGE) {
        const defaultResult = i18nTranslations[I18N_DEFAULT_LANGUAGE]?.[key];
        if (defaultResult !== undefined) {
            return defaultResult;
        }
    }

    return fallback !== null ? fallback : key;
}

function localizeHtmlResource(htmlResource) {
    if (!htmlResource) return;

    htmlResource.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        const translated = t(key, null);
        if (translated && translated !== key) {
            el.textContent = translated;
        }
    });

    htmlResource.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        const translated = t(key, null);
        if (translated && translated !== key) {
            el.placeholder = translated;
        }
    });
}

