import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { supportedLanguages, type SupportedLanguage } from '@/i18n';

interface LanguageSwitcherProps {
  variant?: 'default' | 'ghost' | 'outline';
  size?: 'default' | 'sm' | 'icon';
  showLabel?: boolean;
  className?: string;
}

const languageLabels: Record<SupportedLanguage, { label: string; flag: string }> = {
  fr: { label: 'Français', flag: '🇫🇷' },
  en: { label: 'English', flag: '🇬🇧' },
};

export const LanguageSwitcher = ({
  variant = 'ghost',
  size = 'icon',
  showLabel = false,
  className,
}: LanguageSwitcherProps) => {
  const { i18n, t } = useTranslation();
  
  const currentLanguage = (i18n.language?.split('-')[0] || 'fr') as SupportedLanguage;
  const currentLangInfo = languageLabels[currentLanguage] || languageLabels.fr;

  const handleLanguageChange = (lang: SupportedLanguage) => {
    i18n.changeLanguage(lang);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant={variant} 
          size={size}
          className={cn('gap-2', className)}
          aria-label={t('language.select')}
        >
          <Globe className="h-4 w-4" />
          {showLabel && (
            <span className="hidden sm:inline">
              {currentLangInfo.flag} {currentLangInfo.label}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[150px]">
        {supportedLanguages.map((lang) => {
          const langInfo = languageLabels[lang];
          const isActive = currentLanguage === lang;
          
          return (
            <DropdownMenuItem
              key={lang}
              onClick={() => handleLanguageChange(lang)}
              className={cn(
                'flex items-center gap-2 cursor-pointer',
                isActive && 'bg-accent'
              )}
            >
              <span className="text-lg">{langInfo.flag}</span>
              <span>{langInfo.label}</span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default LanguageSwitcher;
