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

export const NotificationCenter = () => {
  const { t, i18n } = useTranslation('navigation');
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const navigate = useNavigate();
  
  const dateLocale = i18n.language === 'fr' ? fr : enUS;

  const handleNotificationClick = (notification: any) => {
    markAsRead(notification.id);
    
    if (notification.type === 'startlist_validated') {
      navigate('/dashboard/startlist');
    } else if (notification.type === 'results_added') {
      navigate('/dashboard/resultats');
    } else if (notification.type === 'auction_opened' || notification.type === 'auction_closed' || notification.type === 'auction_ready_to_close') {
      navigate(`/dashboard/encheres?leagueId=${notification.metadata.league_id}`);
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5 text-primary" />
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
            <div className="divide-y">
              {notifications.map((notif) => (
                <div
                  key={notif.id}
                  className={`p-4 cursor-pointer hover:bg-accent transition-colors ${
                    !notif.is_read ? 'bg-accent/50' : ''
                  }`}
                  onClick={() => handleNotificationClick(notif)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <p className="font-medium text-sm">{notif.title}</p>
                      <p className="text-sm text-muted-foreground">{notif.message}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDistanceToNow(new Date(notif.created_at), {
                          addSuffix: true,
                          locale: dateLocale
                        })}
                      </p>
                    </div>
                    {!notif.is_read && (
                      <div className="h-2 w-2 rounded-full bg-primary flex-shrink-0 mt-1" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};
