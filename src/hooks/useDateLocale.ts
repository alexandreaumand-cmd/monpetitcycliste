import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { fr, enUS } from 'date-fns/locale';
import type { Locale } from 'date-fns';

const localeMap: Record<string, Locale> = {
  fr: fr,
  en: enUS,
};

/**
 * Hook to get the appropriate date-fns locale based on the current i18n language
 */
export const useDateLocale = (): Locale => {
  const { i18n } = useTranslation();
  
  const locale = useMemo(() => {
    const lang = i18n.language?.split('-')[0] || 'fr';
    return localeMap[lang] || fr;
  }, [i18n.language]);
  
  return locale;
};

export default useDateLocale;
