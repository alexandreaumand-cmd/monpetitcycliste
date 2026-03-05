import { forwardRef } from 'react';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { MessageSquare, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ManagerStars } from '@/components/startlist/ManagerStars';
import { cn } from '@/lib/utils';

interface StartlistDesktopExportProps {
  startlistData: any;
  onRouteImageClick?: () => void;
}

export const StartlistDesktopExport = forwardRef<HTMLDivElement, StartlistDesktopExportProps>(
  ({ startlistData, onRouteImageClick }, ref) => {
    return (
      <div ref={ref} className="relative space-y-4 bg-white">
        {/* Badge SL officielle - visible uniquement si validé */}
        {startlistData.pcs_validated && (
          <div className="absolute top-2 right-2 z-10 bg-green-600 text-white px-3 py-1 rounded-full flex items-center gap-1 text-sm font-semibold shadow-lg">
            <CheckCircle2 className="h-4 w-4" />
            SL officielle
          </div>
        )}

        {/* Header compact avec barème */}
        <Card className="p-4">
          <div className="mb-3">
            <h2 className="text-xl font-bold">{startlistData.race.nom}</h2>
            <p className="text-sm text-muted-foreground">
              {format(new Date(startlistData.race.date_debut), 'dd MMMM yyyy', { locale: fr })} • {startlistData.race.categorie}
            </p>
          </div>

          {/* Section barème + parcours optimisée */}
          <div className="space-y-3 mb-3">
            {/* Ligne 1: Barèmes unifiés + Parcours */}
            <div className="grid grid-cols-3 gap-3">
              {/* Barèmes CG + Étapes - 2/3 */}
              <Card className="bg-muted/50 p-3 col-span-2">
                {/* Barème Général */}
                {startlistData.scoring?.rules?.some((r: any) => r.type_classement === 'General') && (
                  <div className="mb-3">
                    <h4 className="font-semibold text-xs mb-2">
                      Barème Général ({startlistData.scoring.categorie})
                    </h4>
                    <div className="grid grid-cols-5 gap-x-4 gap-y-1 text-xs">
                      {startlistData.scoring.rules
                        .filter((r: any) => r.type_classement === 'General')
                        .slice(0, 10)
                        .map((rule: any) => (
                          <div key={`gc-${rule.place}`} className="flex gap-1">
                            <span className="font-medium">{rule.place}e:</span>
                            <span className="text-muted-foreground">{rule.points}pts</span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
                
                {/* Séparateur entre CG et Étapes */}
                {startlistData.scoring?.rules?.some((r: any) => r.type_classement === 'General') && 
                 startlistData.scoring?.rules?.some((r: any) => r.type_classement === 'Etape') && (
                  <Separator className="my-3" />
                )}
                
                {/* Barème Étapes */}
                {startlistData.scoring?.rules?.some((r: any) => r.type_classement === 'Etape') && (
                  <div className={startlistData.admin_rating_note?.trim()?.length > 0 ? 'mb-3' : ''}>
                    <h4 className="font-semibold text-xs mb-2 text-primary">
                      Barème Étapes
                    </h4>
                    <div className="grid grid-cols-5 gap-x-4 gap-y-1 text-xs">
                      {startlistData.scoring.rules
                        .filter((r: any) => r.type_classement === 'Etape')
                        .slice(0, 10)
                        .map((rule: any) => (
                          <div key={`stage-${rule.place}`} className="flex gap-1">
                            <span className="font-medium">{rule.place}e:</span>
                            <span className="text-muted-foreground">{rule.points}pts</span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* Séparateur avant l'avis */}
                {(startlistData.scoring?.rules?.some((r: any) => r.type_classement === 'General') || 
                  startlistData.scoring?.rules?.some((r: any) => r.type_classement === 'Etape')) && 
                 startlistData.admin_rating_note?.trim()?.length > 0 && (
                  <Separator className="my-3" />
                )}

                {/* Avis du startlisteur */}
                {startlistData.admin_rating_note?.trim()?.length > 0 && (
                  <div className="bg-blue-50/50 dark:bg-blue-950/10 border border-blue-200/50 dark:border-blue-800/50 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <MessageSquare className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      <h4 className="font-semibold text-xs">L&apos;avis du startlisteur</h4>
                    </div>
                    <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
                      &quot;{startlistData.admin_rating_note}&quot;
                      {startlistData.admin_rating_author && (
                        <span className="block mt-2 text-xs font-medium text-right italic">
                          — {startlistData.admin_rating_author}
                        </span>
                      )}
                    </p>
                  </div>
                )}
              </Card>
              
              {/* Image parcours - 1/3, plus grande */}
              {startlistData.route_image_url && (
                <Card className="p-3 overflow-hidden col-span-1">
                  <h4 className="font-semibold text-xs mb-2">Parcours</h4>
                  <div className="overflow-hidden rounded-lg border-2 shadow-md">
                    <img 
                      src={startlistData.route_image_url} 
                      alt="Parcours" 
                      className={cn("w-full h-auto object-cover", onRouteImageClick && "cursor-zoom-in")}
                      onClick={onRouteImageClick}
                    />
                  </div>
                </Card>
              )}
            </div>
          </div>

          {/* Le mot du startlisteur */}
          {startlistData.startlisteur_note && (
            <Card className={cn(
              "col-span-4 bg-muted/30 border-amber-300/30",
              startlistData.startlisteur_note.length > 250 ? "p-5 space-y-3" :
              startlistData.startlisteur_note.length > 100 ? "p-4" : "p-3"
            )}>
              <div className="flex items-center gap-2 mb-2">
                <MessageSquare className="h-4 w-4 text-amber-500" />
                <h4 className="font-semibold text-sm text-amber-700 dark:text-amber-400">
                  Le mot du startlisteur
                </h4>
              </div>
              <p className="text-base text-foreground/80 whitespace-pre-wrap leading-relaxed">
                {startlistData.startlisteur_note}
              </p>
            </Card>
          )}

          {/* Stats */}
          <div className="flex gap-4 text-xs">
            <div><span className="font-medium">Managers:</span> {startlistData.totals.managers}</div>
            <div><span className="font-medium">Partants:</span> {startlistData.totals.starters_all}</div>
          </div>
        </Card>

        {/* Section Liste complète des partants (SuperAdmin mode - no managers) */}
        {startlistData?.starters?.length > 0 && startlistData?.managers?.length === 0 && (
          <Card className="p-4">
            <h3 className="text-lg font-semibold mb-4">Liste des partants ({startlistData.starters.length})</h3>
            <div className="grid grid-cols-3 gap-2">
              {startlistData.starters.map((starter: any) => (
                <div key={starter.coureur_id} className="flex items-center gap-2 text-sm py-1 px-2 bg-muted/30 rounded">
                  <span className="font-medium truncate flex-1">{starter.nom}</span>
                  {starter.equipe && (
                    <span className="text-xs text-muted-foreground truncate">{starter.equipe}</span>
                  )}
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Section Managers - Only show if managers exist */}
        {startlistData?.managers?.length > 0 && (
          <Card className="p-4">
            <h3 className="text-lg font-semibold mb-4">Managers au départ</h3>

            {/* Grille compacte des managers */}
            <div className="grid grid-cols-5 gap-3">
              {startlistData.managers.map((manager: any) => (
                <Card key={manager.manager_id} className="p-3">
                  {/* En-tête manager */}
                  <div className="mb-2 pb-2 border-b">
                    <div className="flex items-center gap-2 mb-1">
                      {manager.jersey_image_url ? (
                        <img 
                          src={manager.jersey_image_url} 
                          alt="Maillot" 
                          className="w-8 h-8 object-contain flex-shrink-0"
                        />
                      ) : (
                        <div className="w-8 h-8 flex items-center justify-center flex-shrink-0">
                          <svg className="w-5 h-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-sm truncate mb-1">{manager.manager_nom}</h4>
                        <ManagerStars avgStars={manager.avg_stars} votes={manager.votes} showVotes={manager.votes > 1} />
                        {manager.sponsor && (
                          <p className="text-xs text-muted-foreground truncate mt-1">{manager.sponsor}</p>
                        )}
                      </div>
                    </div>
                  
                    {/* Classements */}
                    <div className="grid grid-cols-2 gap-2 text-xs mb-1">
                      <div>
                        <span className="font-medium">Phase:</span> #{manager.rank_phase || '-'}
                        {manager.points_phase > 0 && (
                          <span className="text-muted-foreground ml-1">({Math.round(manager.points_phase)}pts)</span>
                        )}
                      </div>
                      <div>
                        <span className="font-medium">CG:</span> #{manager.rank_total || '-'}
                        {manager.points_total > 0 && (
                          <span className="text-muted-foreground ml-1">({Math.round(manager.points_total)}pts)</span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Liste coureurs triés par cote décroissante */}
                  <div className="space-y-0.5">
                    {[...manager.starters]
                      .sort((a: any, b: any) => (b.cote || 0) - (a.cote || 0))
                      .map((starter: any) => (
                      <div key={starter.coureur_id} className="text-xs flex justify-between items-center gap-2">
                          <span className="font-medium truncate flex-1 min-w-0">{starter.nom}</span>
                        </div>
                      ))}
                  </div>
                </Card>
              ))}
            </div>
          </Card>
        )}
      </div>
    );
  }
);

StartlistDesktopExport.displayName = 'StartlistDesktopExport';
