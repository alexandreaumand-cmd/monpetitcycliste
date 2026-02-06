import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import French translations
import frCommon from './locales/fr/common.json';
import frTeam from './locales/fr/team.json';
import frAuction from './locales/fr/auction.json';
import frDashboard from './locales/fr/dashboard.json';
import frRankings from './locales/fr/rankings.json';
import frHome from './locales/fr/home.json';
import frAuth from './locales/fr/auth.json';
import frAccount from './locales/fr/account.json';
import frCalendar from './locales/fr/calendar.json';
import frResults from './locales/fr/results.json';
import frLeagues from './locales/fr/leagues.json';
import frNavigation from './locales/fr/navigation.json';
import frErrors from './locales/fr/errors.json';
import frStatistics from './locales/fr/statistics.json';
import frAdmin from './locales/fr/admin.json';
import frData from './locales/fr/data.json';
import frInstall from './locales/fr/install.json';
import frArena from './locales/fr/arena.json';

// Import English translations
import enCommon from './locales/en/common.json';
import enTeam from './locales/en/team.json';
import enAuction from './locales/en/auction.json';
import enDashboard from './locales/en/dashboard.json';
import enRankings from './locales/en/rankings.json';
import enHome from './locales/en/home.json';
import enAuth from './locales/en/auth.json';
import enAccount from './locales/en/account.json';
import enCalendar from './locales/en/calendar.json';
import enResults from './locales/en/results.json';
import enLeagues from './locales/en/leagues.json';
import enNavigation from './locales/en/navigation.json';
import enErrors from './locales/en/errors.json';
import enStatistics from './locales/en/statistics.json';
import enAdmin from './locales/en/admin.json';
import enData from './locales/en/data.json';
import enInstall from './locales/en/install.json';
import enArena from './locales/en/arena.json';

export const resources = {
  fr: {
    common: frCommon,
    team: frTeam,
    auction: frAuction,
    dashboard: frDashboard,
    rankings: frRankings,
    home: frHome,
    auth: frAuth,
    account: frAccount,
    calendar: frCalendar,
    results: frResults,
    leagues: frLeagues,
    navigation: frNavigation,
    errors: frErrors,
    statistics: frStatistics,
    admin: frAdmin,
    data: frData,
    install: frInstall,
    arena: frArena,
  },
  en: {
    common: enCommon,
    team: enTeam,
    auction: enAuction,
    dashboard: enDashboard,
    rankings: enRankings,
    home: enHome,
    auth: enAuth,
    account: enAccount,
    calendar: enCalendar,
    results: enResults,
    leagues: enLeagues,
    navigation: enNavigation,
    errors: enErrors,
    statistics: enStatistics,
    admin: enAdmin,
    data: enData,
    install: enInstall,
    arena: enArena,
  },
} as const;

export const defaultNS = 'common';
export const supportedLanguages = ['fr', 'en'] as const;
export type SupportedLanguage = typeof supportedLanguages[number];

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'fr',
    defaultNS,
    ns: ['common', 'team', 'auction', 'dashboard', 'rankings', 'home', 'auth', 'account', 'calendar', 'results', 'leagues', 'navigation', 'errors', 'statistics', 'admin', 'data', 'install', 'arena'],
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
      lookupLocalStorage: 'i18nextLng',
    },
  });

export default i18n;
