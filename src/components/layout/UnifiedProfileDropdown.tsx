import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { User, Settings, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface UnifiedProfileDropdownProps {
  manager: {
    nom?: string;
    sponsor?: string;
    avatar_url?: string;
  };
  isAdmin: boolean;
  isSuperAdmin: boolean;
  onSignOut: () => void;
  onNavigateAdmin: () => void;
}

export function UnifiedProfileDropdown({
  manager,
  isAdmin,
  isSuperAdmin,
  onSignOut,
  onNavigateAdmin,
}: UnifiedProfileDropdownProps) {
  const { t, i18n } = useTranslation(['dashboard', 'navigation']);
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const currentLang = i18n.language?.startsWith('fr') ? 'fr' : 'en';

  const getInitials = (name?: string) => {
    if (!name) return "?";
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const handleLanguageChange = (lang: string) => {
    i18n.changeLanguage(lang);
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="relative h-10 px-2 gap-2 hover:bg-bordure-gold/10"
        >
          <Avatar className="h-8 w-8 border border-bordure-gold/30">
            <AvatarImage src={manager.avatar_url} alt={manager.nom} />
            <AvatarFallback className="bg-bordure-gold/20 text-bordure-gold text-xs font-medium">
              {getInitials(manager.nom)}
            </AvatarFallback>
          </Avatar>
          <span className="hidden md:inline text-white font-medium text-sm max-w-[100px] truncate">
            {manager.nom}
          </span>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-72 bg-popover z-50">
        {/* Header with manager info */}
        <DropdownMenuLabel className="pb-2">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={manager.avatar_url} alt={manager.nom} />
              <AvatarFallback className="bg-bordure-gold/20 text-bordure-gold">
                {getInitials(manager.nom)}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <span className="font-semibold">{manager.nom}</span>
              {manager.sponsor && (
                <span className="text-xs text-muted-foreground">{manager.sponsor}</span>
              )}
              {isAdmin && (
                <Badge variant="secondary" className="w-fit mt-1 text-xs">
                  Admin
                </Badge>
              )}
            </div>
          </div>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        {/* Language toggle */}
        <div className="px-2 py-2">
          <div className="flex items-center justify-center gap-1 bg-muted rounded-md p-1">
            <Button
              variant={currentLang === 'fr' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 px-3 text-xs flex-1"
              onClick={() => handleLanguageChange('fr')}
            >
              🇫🇷 FR
            </Button>
            <Button
              variant={currentLang === 'en' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 px-3 text-xs flex-1"
              onClick={() => handleLanguageChange('en')}
            >
              🇬🇧 EN
            </Button>
          </div>
        </div>

        <DropdownMenuSeparator />

        {/* Menu items */}
        <DropdownMenuItem onClick={() => { navigate('/dashboard/compte'); setOpen(false); }}>
          <User className="mr-2 h-4 w-4" />
          {t('navigation:profile.account')}
        </DropdownMenuItem>

        {isSuperAdmin && (
          <DropdownMenuItem onClick={() => { onNavigateAdmin(); setOpen(false); }}>
            <Settings className="mr-2 h-4 w-4" />
            {t('dashboard:header.superAdmin')}
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={onSignOut} className="text-destructive focus:text-destructive">
          <LogOut className="mr-2 h-4 w-4" />
          {t('navigation:profile.signOut')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
