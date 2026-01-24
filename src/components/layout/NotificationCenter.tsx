import { Bell } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useNotifications } from "@/hooks/useNotifications";
import { formatDistanceToNow } from "date-fns";
import { fr, enUS } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { useMemo } from "react";
import { cn } from "@/lib/utils";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
  metadata?: {
    round_number?: number;
    auto_launched?: boolean;
    league_id?: string;
    [key: string]: any;
  };
}

interface NotificationCenterProps {
  variant?: 'default' | 'dark';
}

export const NotificationCenter = ({ variant = 'default' }: NotificationCenterProps) => {
  const { t, i18n } = useTranslation('navigation');
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const navigate = useNavigate();
  
  const dateLocale = i18n.language === 'fr' ? fr : enUS;

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'results_added':
        return '🏆';
      case 'startlist_validated':
        return '📋';
      case 'auction_opened':
      case 'auction_closed':
      case 'auction_ready_to_close':
        return '🔨';
      default:
        return '🔔';
    }
  };

  // Translate notification based on type and metadata
  const getTranslatedNotification = useMemo(() => {
    return (notification: Notification) => {
      const type = notification.type;
      const round = notification.metadata?.round_number;
      const isAuto = notification.metadata?.auto_launched;
      const raceName = notification.metadata?.race_name;
      const stage = notification.metadata?.etape_numero;
      
      // Map notification types to translation keys
      const typeKey = `notifications.types.${type}`;
      
      // Check if translation exists for this type
      const titleKey = isAuto ? `${typeKey}.titleAuto` : `${typeKey}.title`;
      
      // For results_added, use messageWithStage if stage is available
      let messageKey = isAuto ? `${typeKey}.messageAuto` : `${typeKey}.message`;
      if (type === 'results_added' && stage) {
        messageKey = `${typeKey}.messageWithStage`;
      }
      
      const translatedTitle = t(titleKey, { round, raceName, stage, defaultValue: '' });
      const translatedMessage = t(messageKey, { round, raceName, stage, defaultValue: '' });
      
      // If translation exists, use it; otherwise fall back to original
      return {
        title: translatedTitle || notification.title,
        message: translatedMessage || notification.message
      };
    };
  }, [t]);

  const handleNotificationClick = (notification: Notification) => {
    markAsRead(notification.id);
    
    if (notification.type === 'startlist_validated') {
      navigate('/dashboard/startlist');
    } else if (notification.type === 'results_added') {
      navigate('/dashboard/resultats');
    } else if (notification.type === 'auction_opened' || notification.type === 'auction_closed' || notification.type === 'auction_ready_to_close') {
      navigate(`/dashboard/encheres?leagueId=${notification.metadata?.league_id}`);
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className={cn("relative", variant === 'dark' && "hover:bg-yellow-500/10")}
        >
          <Bell className={cn(
            "h-5 w-5",
            variant === 'dark' ? "text-yellow-500" : "text-primary"
          )} />
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
            >
              {unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end">
        <div className="flex items-center justify-between p-4 border-b">
          <h4 className="font-semibold">{t('notifications.title')}</h4>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" onClick={markAllAsRead}>
              {t('notifications.markAllRead')}
            </Button>
          )}
        </div>
        <ScrollArea className="h-[400px]">
          {notifications.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              {t('notifications.empty')}
            </div>
          ) : (
            <div className="space-y-1 p-2">
              {notifications.map((notif: Notification) => {
                const translated = getTranslatedNotification(notif);
                return (
                  <button
                    key={notif.id}
                    onClick={() => handleNotificationClick(notif)}
                    className={cn(
                      "w-full text-left p-3 rounded-md text-sm transition-colors hover:bg-muted",
                      !notif.is_read && "bg-muted/50"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-lg flex-shrink-0">{getNotificationIcon(notif.type)}</span>
                      <div className="flex-1 min-w-0">
                        <p className={cn(
                          "font-medium",
                          !notif.is_read && "text-foreground"
                        )}>
                          {translated.title}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDistanceToNow(new Date(notif.created_at), {
                            addSuffix: true,
                            locale: dateLocale
                          })}
                        </p>
                      </div>
                      {!notif.is_read && (
                        <span className="h-2 w-2 mt-2 rounded-full bg-yellow-500 flex-shrink-0" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};
