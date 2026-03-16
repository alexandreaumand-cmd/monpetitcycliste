import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle, Zap, WifiOff, Maximize, Share, Plus, Check, MoreVertical, Download } from 'lucide-react';

const InstallPage: React.FC = () => {
  const { t } = useTranslation('install');
  const { isInstallable, isInstalled, isIOS, isAndroid, install } = usePWAInstall();

  const handleInstall = async () => {
    await install();
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 flex flex-col">
      {/* Header with logo */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-8">
        <div className="text-center mb-8">
          <img 
            src="/favicon.png" 
            alt="La Bordure" 
            className="w-24 h-24 mx-auto mb-4 rounded-2xl shadow-lg"
          />
          <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
            {t('title')}
          </h1>
          <p className="text-muted-foreground">
            {t('subtitle')}
          </p>
        </div>

        {/* Already installed state */}
        {isInstalled && (
          <Card className="w-full max-w-md mb-6 border-green-500/50 bg-green-500/10">
            <CardContent className="p-6 text-center">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
              <h2 className="text-lg font-semibold text-green-600 mb-2">
                {t('alreadyInstalled')}
              </h2>
              <p className="text-sm text-muted-foreground">
                {t('alreadyInstalledDesc')}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Native install button (Chrome/Edge on supported platforms) */}
        {isInstallable && !isInstalled && (
          <Button 
            onClick={handleInstall}
            size="lg"
            className="mb-6 bg-bordure-gold hover:bg-bordure-gold text-foreground font-semibold px-8 py-6 text-lg"
          >
            <Download className="w-5 h-5 mr-2" />
            {t('installButton')}
          </Button>
        )}

        {/* Advantages section */}
        {!isInstalled && (
          <div className="w-full max-w-md mb-8">
            <h3 className="text-lg font-semibold mb-4 text-center">
              {t('advantages.title')}
            </h3>
            <div className="grid gap-3">
              <Card>
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-bordure-gold/20 flex items-center justify-center">
                    <Zap className="w-5 h-5 text-bordure-gold" />
                  </div>
                  <div>
                    <p className="font-medium">{t('advantages.fast.title')}</p>
                    <p className="text-sm text-muted-foreground">{t('advantages.fast.desc')}</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                    <WifiOff className="w-5 h-5 text-blue-500" />
                  </div>
                  <div>
                    <p className="font-medium">{t('advantages.offline.title')}</p>
                    <p className="text-sm text-muted-foreground">{t('advantages.offline.desc')}</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                    <Maximize className="w-5 h-5 text-purple-500" />
                  </div>
                  <div>
                    <p className="font-medium">{t('advantages.fullscreen.title')}</p>
                    <p className="text-sm text-muted-foreground">{t('advantages.fullscreen.desc')}</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Platform-specific instructions */}
        {!isInstalled && !isInstallable && (
          <Card className="w-full max-w-md mb-6">
            <CardContent className="p-6">
              {isIOS ? (
                <>
                  <h3 className="font-semibold mb-4 text-center">{t('ios.title')}</h3>
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center font-bold">
                        <Share className="w-5 h-5" />
                      </div>
                      <p className="flex-1">{t('ios.step1')}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center font-bold">
                        <Plus className="w-5 h-5" />
                      </div>
                      <p className="flex-1">{t('ios.step2')}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center font-bold">
                        <Check className="w-5 h-5" />
                      </div>
                      <p className="flex-1">{t('ios.step3')}</p>
                    </div>
                  </div>
                </>
              ) : isAndroid ? (
                <>
                  <h3 className="font-semibold mb-4 text-center">{t('android.title')}</h3>
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                        <MoreVertical className="w-5 h-5" />
                      </div>
                      <p className="flex-1">{t('android.step1')}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                        <Download className="w-5 h-5" />
                      </div>
                      <p className="flex-1">{t('android.step2')}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                        <Check className="w-5 h-5" />
                      </div>
                      <p className="flex-1">{t('android.step3')}</p>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <h3 className="font-semibold mb-4 text-center">{t('desktop.title')}</h3>
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                        <Download className="w-5 h-5" />
                      </div>
                      <p className="flex-1">{t('desktop.step1')}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                        <MoreVertical className="w-5 h-5" />
                      </div>
                      <p className="flex-1">{t('desktop.step2')}</p>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* Continue on web link */}
        <Link 
          to="/" 
          className="text-muted-foreground hover:text-foreground underline-offset-4 hover:underline transition-colors"
        >
          {t('continueWeb')}
        </Link>
      </div>
    </div>
  );
};

export default InstallPage;
