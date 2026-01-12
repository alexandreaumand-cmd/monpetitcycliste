import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Megaphone, Copy, CheckCircle2, Zap } from "lucide-react";
import { formatAmount } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Announcement {
  id: string;
  type: 'gain' | 'egalite';
  coureur_nom: string;
  manager_nom?: string;
  winning_amount?: number;
  published: boolean;
}

interface AnnouncementsLiveProps {
  announcements: Announcement[];
  currentText: string;
  onPublishNext: () => void;
  onPublishAll: () => void;
  onCopy: () => void;
  isLoading?: boolean;
}

export const AnnouncementsLive = ({
  announcements,
  currentText,
  onPublishNext,
  onPublishAll,
  onCopy,
  isLoading
}: AnnouncementsLiveProps) => {
  const unpublished = announcements.filter(a => !a.published);
  const published = announcements.filter(a => a.published);
  const nextAnnouncement = unpublished[0];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Megaphone className="h-5 w-5" />
              Annonces Live
            </div>
            {unpublished.length === 0 && published.length > 0 && (
              <p className="text-xs text-green-600 mt-1 font-normal">
                ✅ Toutes publiées · Le prochain round sera lancé automatiquement
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="gap-1">
              <Zap className="h-3 w-3" />
              Auto-launch
            </Badge>
            <Badge variant="outline">
              {unpublished.length} restante{unpublished.length > 1 ? 's' : ''}
            </Badge>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {nextAnnouncement ? (
          <>
            <Alert className="bg-primary/5 border-primary/20">
              <AlertDescription>
                <div className="space-y-1">
                  <p className="font-bold text-lg">{nextAnnouncement.coureur_nom}</p>
                  {nextAnnouncement.type === 'gain' && nextAnnouncement.manager_nom && (
                    <p className="text-sm">
                      Gagné par <span className="font-medium">{nextAnnouncement.manager_nom}</span>
                      {nextAnnouncement.winning_amount && (
                        <> - {formatAmount(nextAnnouncement.winning_amount)}</>
                      )}
                    </p>
                  )}
                  {nextAnnouncement.type === 'egalite' && (
                    <p className="text-sm text-orange-600 font-medium">⚖️ Égalité</p>
                  )}
                </div>
              </AlertDescription>
            </Alert>

            <div className="flex gap-2">
              <Button 
                onClick={onPublishNext}
                disabled={isLoading}
                className="flex-1 gap-2"
              >
                <Megaphone className="h-4 w-4" />
                Annoncer
              </Button>
              {unpublished.length > 1 && (
                <Button 
                  onClick={onPublishAll}
                  disabled={isLoading}
                  variant="outline"
                  className="gap-2"
                >
                  Tout ({unpublished.length})
                </Button>
              )}
            </div>

            {currentText && (
              <Card className="bg-muted">
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between gap-4">
                    <pre className="text-sm whitespace-pre-wrap flex-1 font-mono">
                      {currentText}
                    </pre>
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      onClick={onCopy}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        ) : (
          <div className="text-center text-muted-foreground py-8">
            ✅ Toutes les annonces publiées
          </div>
        )}

        {published.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">
              Timeline ({published.length})
            </h4>
            <ScrollArea className="h-[200px]">
              <div className="space-y-2 pr-4">
                {(() => {
                  const totalCount = announcements.length;
                  // Afficher le message quand il reste exactement 10 annonces à publier
                  const unpublishedCount = unpublished.length;
                  const shouldShowTop10 = totalCount > 10 && unpublishedCount === 10;

                  return published.map((annonce, idx) => {
                    // Le message apparaît en haut de la liste (avant la dernière annonce publiée)
                    const showTop10Before = shouldShowTop10 && idx === 0;

                    return (
                      <div key={`wrapper-${annonce.id}`}>
                        {/* Message Top 10 */}
                        {showTop10Before && (
                          <div className="p-3 rounded bg-gradient-to-r from-yellow-500/30 to-orange-500/30 border border-yellow-500 text-center mb-2">
                            <p className="font-bold text-sm">🏆 Top 10 ! 🏆</p>
                          </div>
                        )}

                        {/* Item de timeline */}
                        <div className="flex items-center justify-between p-2 bg-muted/50 rounded text-sm">
                          <div className="flex-1">
                            <p className="font-medium">{annonce.coureur_nom}</p>
                            {annonce.type === 'gain' && annonce.manager_nom && (
                              <p className="text-xs text-muted-foreground">
                                {annonce.manager_nom}
                                {annonce.winning_amount && ` - ${formatAmount(annonce.winning_amount)}`}
                              </p>
                            )}
                            {annonce.type === 'egalite' && (
                              <p className="text-xs text-orange-600">Égalité</p>
                            )}
                          </div>
                          <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </ScrollArea>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
