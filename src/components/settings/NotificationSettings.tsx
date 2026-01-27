import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Bell, Loader2, AlertCircle, Trophy, ListChecks, Gavel } from "lucide-react";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { toast } from "sonner";

export function NotificationSettings() {
  const { t } = useTranslation('account');
  const {
    isSupported,
    permission,
    isSubscribed,
    preferences,
    isLoading,
    subscribe,
    unsubscribe,
    updatePreferences,
  } = usePushNotifications();

  const handleTogglePush = async (enabled: boolean) => {
    if (enabled) {
      const success = await subscribe();
      if (success) {
        toast.success(t('notifications.enabledSuccess'));
      } else if (permission === 'denied') {
        toast.error(t('notifications.permissionDenied'));
      } else {
        toast.error(t('notifications.enableError'));
      }
    } else {
      const success = await unsubscribe();
      if (success) {
        toast.success(t('notifications.disabledSuccess'));
      } else {
        toast.error(t('notifications.disableError'));
      }
    }
  };

  const handlePreferenceChange = async (key: keyof typeof preferences, value: boolean) => {
    const success = await updatePreferences({ [key]: value });
    if (!success) {
      toast.error(t('notifications.updateError'));
    }
  };

  // Check if running on iOS Safari (special instructions needed)
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          {t('notifications.title')}
        </CardTitle>
        <CardDescription className="hidden sm:block">
          {t('notifications.description')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 sm:space-y-6">
        {/* Browser not supported */}
        {!isSupported && (
          <div className="flex items-start gap-3 p-4 bg-muted rounded-lg">
            <AlertCircle className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div>
              <p className="text-sm font-medium">{t('notifications.notSupported')}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {isIOS ? t('notifications.iosInstructions') : t('notifications.browserInstructions')}
              </p>
            </div>
          </div>
        )}

        {/* Permission denied */}
        {isSupported && permission === 'denied' && (
          <div className="flex items-start gap-3 p-4 bg-destructive/10 rounded-lg">
            <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
            <div>
              <p className="text-sm font-medium text-destructive">{t('notifications.permissionBlocked')}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {t('notifications.permissionBlockedInstructions')}
              </p>
            </div>
          </div>
        )}

        {/* Main push toggle */}
        {isSupported && permission !== 'denied' && (
          <>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="push-toggle" className="text-base font-medium">
                  {t('notifications.enablePush')}
                </Label>
                <p className="text-sm text-muted-foreground">
                  {t('notifications.enablePushDescription')}
                </p>
              </div>
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Switch
                  id="push-toggle"
                  checked={isSubscribed}
                  onCheckedChange={handleTogglePush}
                />
              )}
            </div>

            {/* Preference toggles - only shown when subscribed */}
            {isSubscribed && (
              <div className="space-y-4 pt-4 border-t">
                <p className="text-sm font-medium text-muted-foreground">
                  {t('notifications.preferencesTitle')}
                </p>

                {/* Results notifications */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Trophy className="h-4 w-4 text-primary" />
                    <div>
                      <Label htmlFor="pref-results" className="text-sm font-medium">
                        {t('notifications.types.results')}
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        {t('notifications.types.resultsDescription')}
                      </p>
                    </div>
                  </div>
                  <Switch
                    id="pref-results"
                    checked={preferences.results}
                    onCheckedChange={(checked) => handlePreferenceChange('results', checked)}
                  />
                </div>

                {/* Startlist notifications */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <ListChecks className="h-4 w-4 text-primary" />
                    <div>
                      <Label htmlFor="pref-startlists" className="text-sm font-medium">
                        {t('notifications.types.startlists')}
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        {t('notifications.types.startlistsDescription')}
                      </p>
                    </div>
                  </div>
                  <Switch
                    id="pref-startlists"
                    checked={preferences.startlists}
                    onCheckedChange={(checked) => handlePreferenceChange('startlists', checked)}
                  />
                </div>

                {/* Auction notifications */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Gavel className="h-4 w-4 text-primary" />
                    <div>
                      <Label htmlFor="pref-auctions" className="text-sm font-medium">
                        {t('notifications.types.auctions')}
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        {t('notifications.types.auctionsDescription')}
                      </p>
                    </div>
                  </div>
                  <Switch
                    id="pref-auctions"
                    checked={preferences.auctions}
                    onCheckedChange={(checked) => handlePreferenceChange('auctions', checked)}
                  />
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
