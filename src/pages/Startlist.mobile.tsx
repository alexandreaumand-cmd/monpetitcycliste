import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { toPng } from 'html-to-image';
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  ChipGroup,
  MobileCard,
  MobileBottomSheet,
  KPIRow,
  MobileEmptyState,
  MobileStickyBottom,
} from "@/components/mobile";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Trophy,
  FileText,
  Loader2,
  Users,
  Calendar,
  Star,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  Image as ImageIcon,
  MessageSquare,
  Share2,
} from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
import { ManagerStars } from "@/components/startlist/ManagerStars";
import { ManagerRatingModal } from "@/components/startlist/ManagerRatingModal";
import { useSeasonContext } from "@/contexts/SeasonContext";
import { StartlistDesktopExport } from "@/components/startlist/StartlistDesktopExport";
import { useLeague } from "@/contexts/LeagueContext";

export const StartlistMobile = () => {
  const queryClient = useQueryClient();
  const { isAdmin } = useUserRole();
  const { phases, selectedSeason, isLoading: isLoadingContext } = useSeasonContext();
  const { leagueId } = useLeague();
  const [viewMode, setViewMode] = useState<"list" | "view">("list");
  const [tabMode, setTabMode] = useState<"30days" | "90days" | "history" | "upcoming-year">("30days");
  const [selectedStartlistId, setSelectedStartlistId] = useState<string | null>(null);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [showUnmatched, setShowUnmatched] = useState(false);
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [expandedManagers, setExpandedManagers] = useState<Set<string>>(new Set());
  const exportRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);

  const seasonPhaseIds = phases?.map(p => p.id) || [];

  // Fetch races filtered by league scope
  const { data: races } = useQuery({
    queryKey: ["startlist-races", leagueId, selectedSeason?.id, tabMode],
    queryFn: async () => {
      if (!leagueId) return [];
      
      console.log('[Startlist Mobile] Loading courses for league:', leagueId, 'season:', selectedSeason?.id);
      
      const today = new Date().toISOString().split('T')[0];
      const in30Days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const in90Days = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      // Call edge function to get league courses
      const { data: leagueCourses, error: edgeFnError } = await supabase.functions.invoke(
        'get-league-courses',
        { body: { league_id: leagueId, season_id: selectedSeason?.id } }
      );
      
      if (edgeFnError) {
        console.error('[Startlist Mobile] Error loading courses:', edgeFnError);
        throw edgeFnError;
      }

      console.log('[Startlist Mobile] Loaded courses:', leagueCourses?.courses?.length);
      const raw = leagueCourses?.courses || [];
      const courses = raw.map((c: any) => ({ ...c, id: c.course_id }));
      
      // Filter by tab mode
      let filtered = courses;
      if (tabMode === "history") {
        filtered = courses.filter((c: any) => c.date_fin < today)
          .sort((a: any, b: any) => b.date_fin.localeCompare(a.date_fin));
      } else if (tabMode === "30days") {
        filtered = courses.filter((c: any) => 
          c.date_fin >= today && c.date_debut <= in30Days
        ).sort((a: any, b: any) => a.date_debut.localeCompare(b.date_debut));
      } else if (tabMode === "90days") {
        filtered = courses.filter((c: any) => 
          c.date_fin >= today && c.date_debut <= in90Days
        ).sort((a: any, b: any) => a.date_debut.localeCompare(b.date_debut));
      } else if (tabMode === "upcoming-year") {
        filtered = courses.filter((c: any) => c.date_fin >= today)
          .sort((a: any, b: any) => a.date_debut.localeCompare(b.date_debut));
      }
      
      return filtered.slice(0, 100);
    },
    enabled: !!leagueId && !!selectedSeason?.id
  });

  // Fetch all startlist info in one query
  const { data: startlistsInfo } = useQuery({
    queryKey: ["startlists-info"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("startlist_imports")
        .select("id, race_id, pcs_validated")
        .order("created_at", { ascending: false });
      if (error) throw error;
      
      // Group by race_id, keeping only the most recent
      const byRace = new Map();
      data?.forEach(sl => {
        if (!byRace.has(sl.race_id)) {
          byRace.set(sl.race_id, sl);
        }
      });
      return byRace;
    },
  });


  // Fetch startlist view data
  const { data: startlistViewData, isLoading: viewLoading } = useQuery({
    queryKey: ["startlist-view-mobile", selectedStartlistId, leagueId],
    queryFn: async () => {
      if (!selectedStartlistId) return null;
      
      const { data, error } = await supabase.functions.invoke("startlist-manager-view", {
        body: { 
          startlist_id: selectedStartlistId,
          league_id: leagueId
        },
      });
      
      if (error) throw error;
      return data;
    },
    enabled: !!selectedStartlistId && viewMode === "view",
  });

  const handleShareStartlist = async () => {
    if (!startlistViewData || !exportRef.current) return;
    
    setIsExporting(true);
    
    try {
      await new Promise(resolve => setTimeout(resolve, 150));
      
      const dataUrl = await toPng(exportRef.current, {
        quality: 1,
        pixelRatio: 2,
        cacheBust: true,
        backgroundColor: '#ffffff'
      });
      
      const response = await fetch(dataUrl);
      const blob = await response.blob();
      const fileName = `startlist-${startlistViewData.race.nom}-${format(new Date(), 'yyyy-MM-dd')}.png`;
      
      if (navigator.share && navigator.canShare) {
        const file = new File([blob], fileName, { type: 'image/png' });
        
        if (navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({
              files: [file],
              title: 'Startlist',
              text: `Startlist - ${startlistViewData.race.nom}`
            });
            toast.success("Startlist partagée !");
            return;
          } catch (shareError: any) {
            if (shareError.name !== 'AbortError') {
              console.warn('Partage annulé');
            }
          }
        }
      }
      
      const link = document.createElement('a');
      link.download = fileName;
      link.href = dataUrl;
      link.click();
      toast.success("Startlist téléchargée !");
      
    } catch (error) {
      console.error('Erreur export:', error);
      toast.error("Erreur lors de l'export");
    } finally {
      setIsExporting(false);
    }
  };


  const handleSelectRace = (raceId: string, startlistId: string) => {
    setSelectedStartlistId(startlistId);
    setExpandedManagers(new Set()); // Reset expanded managers
    setViewMode("view");
  };

  // LIST MODE
  if (viewMode === "list") {
    return (
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">Startlists</h2>
        </div>

        {/* 4 onglets */}
        <div className="flex gap-2 overflow-x-auto">
          <Button
            variant={tabMode === "history" ? "default" : "outline"}
            size="sm"
            onClick={() => setTabMode("history")}
            className="flex-1 whitespace-nowrap"
          >
            Historique
          </Button>
          <Button
            variant={tabMode === "30days" ? "default" : "outline"}
            size="sm"
            onClick={() => setTabMode("30days")}
            className="flex-1 whitespace-nowrap"
          >
            30 jours
          </Button>
          <Button
            variant={tabMode === "90days" ? "default" : "outline"}
            size="sm"
            onClick={() => setTabMode("90days")}
            className="flex-1 whitespace-nowrap"
          >
            90 jours
          </Button>
          <Button
            variant={tabMode === "upcoming-year" ? "default" : "outline"}
            size="sm"
            onClick={() => setTabMode("upcoming-year")}
            className="flex-1 whitespace-nowrap"
          >
            Année
          </Button>
        </div>

        {!races || races.length === 0 ? (
        <MobileEmptyState
          icon={<Trophy className="h-12 w-12" />}
          title="Aucune course"
          description={
            tabMode === 'history' 
              ? "Aucune course passée avec startlist" 
              : tabMode === '30days'
              ? "Aucune course prévue dans les 30 prochains jours"
              : tabMode === '90days'
              ? "Aucune course prévue dans les 90 prochains jours"
              : "Aucune course à venir cette année"
          }
        />
        ) : (
          <div className="space-y-3">
            {races.map((race) => {
              const startlistInfo = startlistsInfo?.get(race.id);
              const hasStartlist = !!startlistInfo;
              const isPcsValidated = startlistInfo?.pcs_validated || false;
              
              // En mode "history", n'afficher QUE les courses avec startlist
              if (tabMode === "history" && !hasStartlist) return null;
              
              const today = new Date().toISOString().split('T')[0];
              const isOngoing = race.date_debut <= today && race.date_fin >= today;

              return (
                <MobileCard
                  key={race.id}
                  title={race.nom}
                  subtitle={format(new Date(race.date_debut), "dd MMMM yyyy", { locale: fr })}
                  avatar={
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Calendar className="h-5 w-5 text-primary" />
                    </div>
                  }
                  badge={
                    <div className="flex gap-1">
                      {isOngoing && (
                        <Badge className="bg-red-600 text-white text-xs animate-pulse">
                          EN COURS
                        </Badge>
                      )}
                      {race.categorie && (
                        <Badge variant="outline" className="text-xs">
                          {race.categorie}
                        </Badge>
                      )}
                      {isPcsValidated && (
                        <Badge className="bg-green-600 text-white text-xs">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          PCS OK
                        </Badge>
                      )}
                    </div>
                  }
                  onClick={() => {
                    if (hasStartlist && startlistInfo?.id) {
                      handleSelectRace(race.id, startlistInfo.id);
                    } else {
                      toast.info("Aucune startlist pour cette course");
                    }
                  }}
                />
              );
            })}
          </div>
        )}
      </div>
    );
  }


  // VIEW MODE
  if (viewMode === "view") {
    if (viewLoading) {
      return (
        <div className="p-4 space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full rounded-2xl" />
          ))}
        </div>
      );
    }

    if (!startlistViewData) {
      return (
        <div className="p-4">
          <Button variant="ghost" onClick={() => setViewMode("list")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour
          </Button>
          <MobileEmptyState
            icon={<AlertCircle className="h-12 w-12" />}
            title="Erreur"
            description="Impossible de charger la startlist"
          />
        </div>
      );
    }

    return (
      <div className="pb-20">
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={() => setViewMode("list")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour
            </Button>
            {startlistViewData.pcs_validated && (
              <Badge className="bg-green-600 text-white">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                PCS OK
              </Badge>
            )}
          </div>

          {/* Race info */}
          <div>
            <h2 className="text-xl font-bold">{startlistViewData.race.nom}</h2>
            <p className="text-sm text-muted-foreground">
              {format(new Date(startlistViewData.race.date_debut), "dd MMMM yyyy", { locale: fr })} •{" "}
              {startlistViewData.race.categorie}
            </p>
          </div>

          {/* Section Parcours + Avis - Layout optimisé */}
          <div className="space-y-3">
            {/* Image du parcours - Agrandie */}
            {startlistViewData.route_image_url && (
              <div
                className="rounded-2xl overflow-hidden border-2 cursor-pointer shadow-lg"
                onClick={() => setImageModalOpen(true)}
              >
                <img
                  src={startlistViewData.route_image_url}
                  alt="Parcours"
                  className="w-full h-auto object-cover"
                />
              </div>
            )}

            {/* L'avis du startlisteur - Sans espace vide */}
            {startlistViewData.admin_rating_note?.trim()?.length > 0 && (
              <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <MessageSquare className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <h4 className="font-semibold text-sm">L'avis du startlisteur</h4>
                </div>
                <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
                  "{startlistViewData.admin_rating_note}"
                  {startlistViewData.admin_rating_author && (
                    <span className="block mt-2 text-xs font-medium text-right italic">
                      — {startlistViewData.admin_rating_author}
                    </span>
                  )}
                </p>
              </div>
            )}
          </div>

          {/* Barème de points - Optimisé pour courses à étapes */}
          {startlistViewData.scoring && startlistViewData.scoring.rules && startlistViewData.scoring.rules.length > 0 && (
            <div className="space-y-2">
              {/* Barème Général */}
              {startlistViewData.scoring.rules.some((r: any) => r.type_classement === 'General') && (
                <div className="bg-muted/50 rounded-xl p-3 border">
                  <h4 className="font-semibold text-xs mb-2">
                    Barème Général ({startlistViewData.scoring.categorie})
                  </h4>
                  <div className="grid grid-cols-5 gap-x-3 gap-y-1 text-xs">
                    {startlistViewData.scoring.rules
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
              
              {/* Barème Étapes */}
              {startlistViewData.scoring.rules.some((r: any) => r.type_classement === 'Etape') && (
                <div className="bg-primary/5 rounded-xl p-3 border border-primary/20">
                  <h4 className="font-semibold text-xs mb-2 text-primary">
                    Barème Étapes
                  </h4>
                  <div className="grid grid-cols-5 gap-x-3 gap-y-1 text-xs">
                    {startlistViewData.scoring.rules
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
            </div>
          )}

          {/* Le mot du startlisteur - Dernier */}
          {startlistViewData.startlisteur_note && (
            <div className="bg-muted/30 border border-amber-300/30 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <MessageSquare className="h-4 w-4 text-amber-500" />
                <h4 className="font-semibold text-sm text-amber-700 dark:text-amber-400">
                  Le mot du startlisteur
                </h4>
              </div>
              <p className="text-base text-foreground/80 whitespace-pre-wrap leading-relaxed">
                {startlistViewData.startlisteur_note}
              </p>
            </div>
          )}

          {/* KPIs */}
          <KPIRow
            items={[
              { label: "Managers", value: startlistViewData.totals.managers, icon: <Users className="h-4 w-4" /> },
              { label: "Partants", value: startlistViewData.totals.starters_all, icon: <Trophy className="h-4 w-4" /> },
            ]}
          />

          {/* Managers */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Managers au départ</h3>
            <div className="space-y-3">
              {startlistViewData.managers.map((manager: any) => {
                const isExpanded = expandedManagers.has(manager.manager_id);
                const sortedStarters = [...manager.starters].sort((a: any, b: any) => (b.cote || 0) - (a.cote || 0));
                const displayedStarters = isExpanded ? sortedStarters : sortedStarters.slice(0, 3);
                const hasMore = manager.starters.length > 3;

                return (
                  <MobileCard
                    key={manager.manager_id}
                    title={manager.manager_nom}
                    subtitle={
                      <div className="space-y-1">
                        <ManagerStars avgStars={manager.avg_stars} votes={manager.votes} showVotes={manager.votes > 1} />
                        <div className="flex gap-3 text-xs text-muted-foreground">
                          <span>Phase: #{manager.rank_phase || "-"}</span>
                          <span>CG: #{manager.rank_total || "-"}</span>
                        </div>
                      </div>
                    }
                    avatar={
                      manager.jersey_image_url ? (
                        <img 
                          src={manager.jersey_image_url} 
                          alt="Maillot" 
                          className="h-20 w-20 object-contain"
                        />
                      ) : (
                        <Avatar className="h-20 w-20">
                          <AvatarFallback className="bg-primary/10">
                            {manager.manager_nom
                              .split(" ")
                              .map((n: string) => n[0])
                              .join("")
                              .slice(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                      )
                    }
                    badge={
                      <Badge variant="outline" className="text-xs">
                        {manager.starters_count} coureurs
                      </Badge>
                    }
                  >
                    <div className="mt-2 space-y-1">
                      {displayedStarters.map((starter: any) => (
                        <div key={starter.coureur_id} className="flex items-center justify-between gap-2 text-xs">
                          <span className="font-medium truncate flex-1">{starter.nom}</span>
                        </div>
                      ))}
                      {hasMore && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const newExpanded = new Set(expandedManagers);
                            if (isExpanded) {
                              newExpanded.delete(manager.manager_id);
                            } else {
                              newExpanded.add(manager.manager_id);
                            }
                            setExpandedManagers(newExpanded);
                          }}
                          className="text-xs text-primary font-medium hover:underline w-full text-left"
                        >
                          {isExpanded 
                            ? "Réduire" 
                            : `+${manager.starters.length - 3} autres`}
                        </button>
                      )}
                    </div>
                  </MobileCard>
                );
              })}
            </div>
          </div>

          {/* Sans propriétaire */}
          {startlistViewData.without_owner && startlistViewData.without_owner.length > 0 && (
            <div className="rounded-xl bg-muted/50 p-4">
              <h4 className="font-semibold text-sm mb-2">
                Sans propriétaire ({startlistViewData.without_owner.length})
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {startlistViewData.without_owner.map((coureur: any) => (
                  <Badge key={coureur.coureur_id} variant="outline" className="text-xs">
                    {coureur.nom}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Bouton Partager */}
          <div className="mt-4">
            <Button 
              onClick={handleShareStartlist}
              disabled={isExporting}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
            >
              {isExporting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Génération en cours...
                </>
              ) : (
                <>
                  <Share2 className="h-4 w-4 mr-2" />
                  Partager la startlist
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Composant caché pour l'export desktop */}
        <div className="fixed left-[-9999px] top-0 w-[1200px] bg-white">
          {startlistViewData && (
            <StartlistDesktopExport 
              ref={exportRef}
              startlistData={startlistViewData}
            />
          )}
        </div>

        {/* Sticky button Noter */}
        {isAdmin && startlistViewData.managers.length > 0 && (
          <MobileStickyBottom>
            <Button className="w-full touch-target" onClick={() => setShowRatingModal(true)}>
              <Star className="h-4 w-4 mr-2" />
              Noter les managers
            </Button>
          </MobileStickyBottom>
        )}

        {/* Modal de notation */}
        {isAdmin && startlistViewData.managers.length > 0 && (
          <ManagerRatingModal 
            open={showRatingModal}
            onOpenChange={setShowRatingModal}
            startlistId={selectedStartlistId!}
            managers={startlistViewData.managers}
            initialGlobalNote={startlistViewData.admin_rating_note || ""}
            onRatingsUpdated={() => queryClient.invalidateQueries({ queryKey: ['startlist-view-mobile', selectedStartlistId] })}
          />
        )}

        {/* Image modal */}
        <MobileBottomSheet
          open={imageModalOpen}
          onOpenChange={setImageModalOpen}
          title="Parcours"
        >
          {startlistViewData.route_image_url && (
            <img
              src={startlistViewData.route_image_url}
              alt="Parcours en grand"
              className="w-full h-auto rounded-lg"
            />
          )}
        </MobileBottomSheet>
      </div>
    );
  }

  return null;
};
