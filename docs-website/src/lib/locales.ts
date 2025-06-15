export const LOCALES = [
    'en', // English
    'es', // Spanish
    'fr', // French
    'de', // German
    'it', // Italian
    'pt', // Portuguese
    'ru', // Russian
    'zh', // Chinese
    'ja', // Japanese
    'ko', // Korean
    'ar', // Arabic
    'hi', // Hindi
    'tr', // Turkish
    'nl', // Dutch
    'sv', // Swedish
    'da', // Danish
    'no', // Norwegian
    'fi', // Finnish
    'pl', // Polish
    'cs', // Czech
    'el', // Greek
    'he', // Hebrew
    'id', // Indonesian
    'ms', // Malay
    'th', // Thai
    'vi', // Vietnamese
] as const

export const LOCALE_LABELS: Record<Locale, string> = {
    en: 'English',
    es: 'Español',
    fr: 'Français',
    de: 'Deutsch',
    it: 'Italiano',
    pt: 'Português',
    ru: 'Русский',
    zh: '中文',
    ja: '日本語',
    ko: '한국어',
    ar: 'العربية',
    hi: 'हिन्दी',
    tr: 'Türkçe',
    nl: 'Nederlands',
    sv: 'Svenska',
    da: 'Dansk',
    no: 'Norsk',
    fi: 'Suomi',
    pl: 'Polski',
    cs: 'Čeština',
    el: 'Ελληνικά',
    he: 'עברית',
    id: 'Bahasa Indonesia',
    ms: 'Bahasa Melayu',
    th: 'ไทย',
    vi: 'Tiếng Việt',
}

export type Locale = (typeof LOCALES)[number]
