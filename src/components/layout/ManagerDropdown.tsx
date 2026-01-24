import { User, LogOut, Globe } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuPortal,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { supportedLanguages } from "@/i18n";

const languageLabels: Record<string, { label: string; flag: string }> = {
  fr: { label: "Français", flag: "🇫🇷" },
  en: { label: "English", flag: "🇬🇧" },
};

interface ManagerDropdownProps {
  manager: any;
  isAdmin: boolean;
  onSignOut: () => void;
  avatarUrl?: string;
  compact?: boolean;
}

export function ManagerDropdown({ manager, isAdmin, onSignOut, avatarUrl, compact = false }: ManagerDropdownProps) {
  const { t, i18n } = useTranslation('navigation');
  const navigate = useNavigate();
  const initials = manager.nom?.substring(0, 2).toUpperCase() || "?";

  const handleLanguageChange = (lang: string) => {
    i18n.changeLanguage(lang);
  };

  const currentLang = i18n.language?.substring(0, 2) || 'fr';
  
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {compact ? (
          <Button variant="ghost" size="icon" className="h-9 w-9">
            <Avatar className="h-6 w-6">
              <AvatarImage src={avatarUrl} alt={manager.nom} />
              <AvatarFallback className="text-xs">{initials}</AvatarFallback>
            </Avatar>
          </Button>
        ) : (
          <Button variant="ghost" className="flex items-center gap-2 h-9">
            <Avatar className="h-6 w-6">
              <AvatarImage src={avatarUrl} alt={manager.nom} />
              <AvatarFallback className="text-xs">{initials}</AvatarFallback>
            </Avatar>
            <span className="hidden md:inline font-medium text-sm">{manager.nom}</span>
            {isAdmin && <Badge variant="secondary" className="hidden md:inline-flex text-xs">Admin</Badge>}
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 bg-popover z-50">
        <DropdownMenuLabel>{t('dropdown.myAccount')}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate('/dashboard/compte')}>
          <User className="mr-2 h-4 w-4" />
          <span>{t('dropdown.settings')}</span>
        </DropdownMenuItem>
        
        {/* Language submenu */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Globe className="mr-2 h-4 w-4" />
            <span>{t('dropdown.language', 'Langue')}</span>
            <span className="ml-auto text-xs text-muted-foreground">
              {languageLabels[currentLang]?.flag}
            </span>
          </DropdownMenuSubTrigger>
          <DropdownMenuPortal>
            <DropdownMenuSubContent className="bg-popover">
              {supportedLanguages.map((lang) => (
                <DropdownMenuItem
                  key={lang}
                  onClick={() => handleLanguageChange(lang)}
                  className={currentLang === lang ? "bg-accent" : ""}
                >
                  <span className="mr-2">{languageLabels[lang]?.flag}</span>
                  <span>{languageLabels[lang]?.label}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuPortal>
        </DropdownMenuSub>
        
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onSignOut} className="text-destructive">
          <LogOut className="mr-2 h-4 w-4" />
          <span>{t('dropdown.signOut')}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
