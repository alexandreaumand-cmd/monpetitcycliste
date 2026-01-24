import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { User, Settings, LogOut, Bell, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useNotifications } from "@/hooks/useNotifications";
import { formatDistanceToNow } from "date-fns";
import { fr, enUS } from "date-fns/locale";
import { cn } from "@/lib/utils";

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
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const [open, setOpen] = useState(false);

  const currentLang = i18n.language?.startsWith('fr') ? 'fr' : 'en';
  const dateLocale = currentLang === 'fr' ? fr : enUS;

  const getInitials = (name?: string) => {
    if (!name) return "?";
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const handleLanguageChange = (lang: string) => {
    i18n.changeLanguage(lang);
  };

  const handleNotificationClick = (notification: any) => {
    markAsRead(notification.id);
    const leagueId = notification.metadata?.league_id;
    const leagueParam = leagueId ? `?leagueId=${leagueId}` : '';
    
    switch (notification.type) {
      case 'startlist_validated':
        navigate(`/dashboard/startlist${leagueParam}`);
        break;
      case 'results_added':
        navigate(`/dashboard/resultats${leagueParam}`);
        break;
      case 'auction_opened':
      case 'auction_closed':
        navigate(`/dashboard/encheres${leagueParam}`);
        break;
      default:
        break;
    }
    setOpen(false);
  };

  const recentNotifications = notifications.slice(0, 4);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="relative h-10 px-2 gap-2 hover:bg-yellow-500/10"
        >
          <div className="relative">
            <Avatar className="h-8 w-8 border border-yellow-500/30">
              <AvatarImage src={manager.avatar_url} alt={manager.nom} />
              <AvatarFallback className="bg-yellow-500/20 text-yellow-500 text-xs font-medium">
                {getInitials(manager.nom)}
              </AvatarFallback>
            </Avatar>
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 h-3 w-3 bg-red-500 rounded-full border-2 border-black" />
            )}
          </div>
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
              <AvatarFallback className="bg-yellow-500/20 text-yellow-500">
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

        {/* Notifications section */}
        <div className="px-2 py-1.5">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Bell className="h-4 w-4" />
              {t('navigation:notifications.title')}
              {unreadCount > 0 && (
                <Badge variant="destructive" className="h-5 px-1.5 text-xs">
                  {unreadCount}
                </Badge>
              )}
            </div>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs px-2"
                onClick={(e) => {
                  e.stopPropagation();
                  markAllAsRead();
                }}
              >
                <Check className="h-3 w-3 mr-1" />
                {t('navigation:notifications.markAllRead')}
              </Button>
            )}
          </div>

          {recentNotifications.length > 0 ? (
            <ScrollArea className="h-[140px]">
              <div className="space-y-1">
                {recentNotifications.map((notification) => (
                  <button
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className={cn(
                      "w-full text-left p-2 rounded-md text-sm transition-colors hover:bg-muted",
                      !notification.is_read && "bg-muted/50"
                    )}
                  >
                    <div className="flex items-start gap-2">
                      {!notification.is_read && (
                        <span className="h-2 w-2 mt-1.5 rounded-full bg-yellow-500 flex-shrink-0" />
                      )}
                      <div className={cn("flex-1 min-w-0", notification.is_read && "ml-4")}>
                        <p className="font-medium truncate">{notification.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(notification.created_at), {
                            addSuffix: true,
                            locale: dateLocale,
                          })}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </ScrollArea>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              {t('navigation:notifications.empty')}
            </p>
          )}
        </div>

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
