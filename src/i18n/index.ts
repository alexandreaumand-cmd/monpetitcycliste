import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import French translations
import frCommon from './locales/fr/common.json';
import frTeam from './locales/fr/team.json';
import frAuction from './locales/fr/auction.json';
import frDashboard from './locales/fr/dashboard.json';

// Import English translations
import enCommon from './locales/en/common.json';
import enTeam from './locales/en/team.json';
import enAuction from './locales/en/auction.json';
import enDashboard from './locales/en/dashboard.json';

export const resources = {
  fr: {
    common: frCommon,
    team: frTeam,
    auction: frAuction,
    dashboard: frDashboard,
  },
  en: {
    common: enCommon,
    team: enTeam,
    auction: enAuction,
    dashboard: enDashboard,
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
    ns: ['common', 'team', 'auction', 'dashboard'],
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
