import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { toPng } from 'html-to-image';
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { useDateLocale } from "@/hooks/useDateLocale";
import { ChipGroup, MobileCard, MobileBottomSheet, KPIRow, MobileEmptyState, MobileStickyBottom } from "@/components/mobile";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Trophy, FileText, Loader2, Users, Calendar, CalendarDays, List, Star, CheckCircle2, AlertCircle, ArrowLeft, Image as ImageIcon, MessageSquare, Share2 } from "lucide-react";
import { RouteImageGallery } from "@/components/startlist/RouteImageGallery";
import { useUserRole } from "@/hooks/useUserRole";
import { ManagerStars } from "@/components/startlist/ManagerStars";
import { ManagerRatingModal } from "@/components/startlist/ManagerRatingModal";
import { useSeasonContext } from "@/contexts/SeasonContext";
import { StartlistDesktopExport } from "@/components/startlist/StartlistDesktopExport";
import { useLeague } from "@/contexts/LeagueContext";
import { StartlistCalendarMobile } from "@/components/startlist/StartlistCalendarMobile";
import { StartlistTrackerMovements } from "@/components/startlist/StartlistTrackerMovements";
export const StartlistMobile = () => {
  const {
    t
  } = useTranslation('calendar');
  const {
    t: tCommon
  } = useTranslation('common');
  const dateLocale = useDateLocale();
  const queryClient = useQueryClient();
  const {
    isAdmin
  } = useUserRole();
  const {
    phases,
    selectedSeason,
    isLoading: isLoadingContext
  } = useSeasonContext();
  const {
    leagueId
  } = useLeague();
  const [viewMode, setViewMode] = useState<"list" | "view">("list");
  const [displayMode, setDisplayMode] = useState<"list" | "calendar">("calendar");
  const [tabMode, setTabMode] = useState<"30days" | "90days" | "history" | "upcoming-year">("upcoming-year");
  const [selectedStartlistId, setSelectedStartlistId] = useState<string | null>(null);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [showUnmatched, setShowUnmatched] = useState(false);
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [expandedManagers, setExpandedManagers] = useState<Set<string>>(new Set());
  const exportRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const seasonPhaseIds = phases?.map(p => p.id) || [];
  const [searchParams, setSearchParams] = useSearchParams();
  const startlistIdFromUrl = searchParams.get('startlistId');

  // Open startlist from URL param (deep linking from notifications)
  useEffect(() => {
    if (startlistIdFromUrl) {
      setSelectedStartlistId(startlistIdFromUrl);
      setViewMode('view');
      // Clean up URL after opening
      searchParams.delete('startlistId');
      setSearchParams(searchParams, { replace: true });
    }
  }, [startlistIdFromUrl]);

  // Fetch current user's manager ID
  const {
    data: currentUserManagerId
  } = useQuery({
    queryKey: ["current-user-manager"],
    queryFn: async () => {
      const {
        data: {
          user
        }
      } = await supabase.auth.getUser();
      if (!user) return null;
      const {
        data: manager
      } = await supabase.from("managers").select("id").eq("user_id", user.id).maybeSingle();
      return manager?.id || null;
    }
  });

  // Fetch races filtered by league scope
  const {
    data: races
  } = useQuery({
    queryKey: ["startlist-races", leagueId, selectedSeason?.id, tabMode],
    staleTime: 60000, // Cache 1 minute
    enabled: !!leagueId && !!selectedSeason?.id && !isLoadingContext,
    queryFn: async () => {
      if (!leagueId) return [];
      console.log('[Startlist Mobile] Loading courses for league:', leagueId, 'season:', selectedSeason?.id);
      const today = new Date().toISOString().split('T')[0];
      const in30Days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const in90Days = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      // Call edge function to get league courses
      const {
        data: leagueCourses,
        error: edgeFnError
      } = await supabase.functions.invoke('get-league-courses', {
        body: {
          league_id: leagueId,
          season_id: selectedSeason?.id
        }
      });
      if (edgeFnError) {
        console.error('[Startlist Mobile] Error loading courses:', edgeFnError);
        throw edgeFnError;
      }
      console.log('[Startlist Mobile] Loaded courses:', leagueCourses?.courses?.length);
      const raw = leagueCourses?.courses || [];
      const courses = raw.map((c: any) => ({
        ...c,
        id: c.course_id
      }));

      // Filter by tab mode - sort upcoming courses with next course first
      let filtered = courses;
      if (tabMode === "history") {
        // Past courses: most recent first
        filtered = courses.filter((c: any) => c.date_fin < today).sort((a: any, b: any) => b.date_fin.localeCompare(a.date_fin));
      } else {
        // All upcoming modes: filter then sort by date_debut ascending (next course first)
        let upcoming = courses.filter((c: any) => c.date_fin >= today);
        if (tabMode === "30days") {
          upcoming = upcoming.filter((c: any) => c.date_debut <= in30Days);
        } else if (tabMode === "90days") {
          upcoming = upcoming.filter((c: any) => c.date_debut <= in90Days);
        }
        // 'upcoming-year' shows all upcoming, no additional filter

        // Sort by proximity to today: closest start date first
        filtered = upcoming.sort((a: any, b: any) => a.date_debut.localeCompare(b.date_debut));
      }
      return filtered.slice(0, 100);
    }
  });

  // Fetch all startlist info in one query
  const {
    data: startlistsInfo
  } = useQuery({
    queryKey: ["startlists-info"],
    staleTime: 60000, // Cache 1 minute
    queryFn: async () => {
      const {
        data,
        error
      } = await supabase.from("startlist_imports").select("id, race_id, pcs_validated").order("created_at", {
        ascending: false
      });
      if (error) throw error;

      // Group by race_id, keeping only the most recent
      const byRace = new Map();
      data?.forEach(sl => {
        if (!byRace.has(sl.race_id)) {
          byRace.set(sl.race_id, sl);
        }
      });
      return byRace;
    }
  });

  // Fetch startlist view data
  const {
    data: startlistViewData,
    isLoading: viewLoading
  } = useQuery({
    queryKey: ["startlist-view-mobile", selectedStartlistId, leagueId],
    queryFn: async () => {
      if (!selectedStartlistId) return null;
      const {
        data,
        error
      } = await supabase.functions.invoke("startlist-manager-view", {
        body: {
          startlist_id: selectedStartlistId,
          league_id: leagueId
        }
      });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedStartlistId && viewMode === "view"
  });

  // Auto-expand current user's manager accordion when data loads
  useEffect(() => {
    if (startlistViewData?.managers && currentUserManagerId) {
      const userManager = startlistViewData.managers.find((m: any) => m.manager_id === currentUserManagerId);
      if (userManager) {
        setExpandedManagers(new Set([currentUserManagerId]));
      }
    }
  }, [startlistViewData, currentUserManagerId]);
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
        const file = new File([blob], fileName, {
          type: 'image/png'
        });
        if (navigator.canShare({
          files: [file]
        })) {
          try {
            await navigator.share({
              files: [file],
              title: 'Startlist',
              text: `Startlist - ${startlistViewData.race.nom}`
            });
            toast.success(t('startlist.shared'));
            return;
          } catch (shareError: any) {
            if (shareError.name !== 'AbortError') {
              console.warn('Share cancelled');
            }
          }
        }
      }
      const link = document.createElement('a');
      link.download = fileName;
      link.href = dataUrl;
      link.click();
      toast.success(t('startlist.downloaded'));
    } catch (error) {
      console.error('Export error:', error);
      toast.error(t('startlist.exportError'));
    } finally {
      setIsExporting(false);
    }
  };
  const handleSelectRace = (raceId: string, startlistId: string) => {
    setSelectedStartlistId(startlistId);
    setExpandedManagers(new Set()); // Reset expanded managers
    setViewMode("view");
  };
  const getEmptyDescription = () => {
    switch (tabMode) {
      case 'history':
        return t('startlist.noRaceHistory');
      case '30days':
        return t('startlist.noRace30');
      case '90days':
        return t('startlist.noRace90');
      default:
        return t('startlist.noRaceYear');
    }
  };

  // Helper functions for calendar view
  const hasStartlistForRace = (raceId: string) => !!startlistsInfo?.get(raceId);
  const isPcsValidatedForRace = (raceId: string) => startlistsInfo?.get(raceId)?.pcs_validated || false;
  const handleCalendarSelectRace = (race: any) => {
    const startlistInfo = startlistsInfo?.get(race.id);
    if (startlistInfo?.id) {
      handleSelectRace(race.id, startlistInfo.id);
    } else {
      toast.info(t('startlist.noStartlist'));
    }
  };

  // LIST MODE
  if (viewMode === "list") {
    return <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">{t('startlist.title')}</h2>
          
          {/* Toggle list/calendar */}
          <div className="flex border rounded-lg overflow-hidden">
            <Button variant={displayMode === "list" ? "default" : "ghost"} size="sm" className="rounded-none h-8 px-3" onClick={() => setDisplayMode("list")}>
              <List className="h-4 w-4" />
            </Button>
            <Button variant={displayMode === "calendar" ? "default" : "ghost"} size="sm" className="rounded-none h-8 px-3" onClick={() => setDisplayMode("calendar")}>
              <CalendarDays className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Tabs - only show for list mode */}
        {displayMode === "list" && <div className="flex gap-2 overflow-x-auto">
            <Button variant={tabMode === "history" ? "default" : "outline"} size="sm" onClick={() => setTabMode("history")} className="flex-1 whitespace-nowrap">
              {t('startlist.tabs.history')}
            </Button>
            <Button variant={tabMode === "30days" ? "default" : "outline"} size="sm" onClick={() => setTabMode("30days")} className="flex-1 whitespace-nowrap">
              {t('startlist.tabs.days30')}
            </Button>
            <Button variant={tabMode === "90days" ? "default" : "outline"} size="sm" onClick={() => setTabMode("90days")} className="flex-1 whitespace-nowrap">
              {t('startlist.tabs.days90')}
            </Button>
            <Button variant={tabMode === "upcoming-year" ? "default" : "outline"} size="sm" onClick={() => setTabMode("upcoming-year")} className="flex-1 whitespace-nowrap">
              {t('startlist.tabs.year')}
            </Button>
          </div>}

        {/* Calendar view */}
        {displayMode === "calendar" && races && races.length > 0 && <StartlistCalendarMobile courses={races} hasStartlist={hasStartlistForRace} isPcsValidated={isPcsValidatedForRace} onSelectRace={handleCalendarSelectRace} />}

        {/* List view */}
        {displayMode === "list" && <>
            {!races || races.length === 0 ? <MobileEmptyState icon={<Trophy className="h-12 w-12" />} title={t('startlist.noRace')} description={getEmptyDescription()} /> : <div className="space-y-3">
                {races.map(race => {
            const startlistInfo = startlistsInfo?.get(race.id);
            const hasStartlist = !!startlistInfo;
            const isPcsValidated = startlistInfo?.pcs_validated || false;

            // En mode "history", n'afficher QUE les courses avec startlist
            if (tabMode === "history" && !hasStartlist) return null;
            const today = new Date().toISOString().split('T')[0];
            const isOngoing = race.date_debut <= today && race.date_fin >= today;
            return <MobileCard key={race.id} title={race.nom} subtitle={<div className="flex flex-wrap items-center gap-1 mt-0.5">
                          {isOngoing && <Badge className="bg-destructive text-destructive-foreground text-[10px] px-1.5 py-0 animate-pulse">
                              {t('badges.inProgress')}
                            </Badge>}
                          {race.categorie && <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                              {race.categorie}
                            </Badge>}
                          {isPcsValidated && <Badge className="bg-green-600 text-white text-[10px] px-1.5 py-0">
                              <CheckCircle2 className="h-3 w-3 mr-0.5" />
                              SL officielle
                            </Badge>}
                        </div>} meta={format(new Date(race.date_debut), "dd MMMM yyyy", {
              locale: dateLocale
            })} avatar={<div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <Calendar className="h-5 w-5 text-primary" />
                        </div>} onClick={() => {
              if (hasStartlist && startlistInfo?.id) {
                handleSelectRace(race.id, startlistInfo.id);
              } else {
                toast.info(t('startlist.noStartlist'));
              }
            }} />;
          })}
              </div>}
          </>}
        
        {/* Empty state for calendar */}
        {displayMode === "calendar" && (!races || races.length === 0) && <MobileEmptyState icon={<Trophy className="h-12 w-12" />} title={t('startlist.noRace')} description={getEmptyDescription()} />}

        {/* Startlist tracker movements for current phase */}
        {(() => {
          const today = new Date().toISOString().split('T')[0];
          const currentPhase = phases?.find(p => p.date_debut <= today && p.date_fin >= today)
            || phases?.filter(p => p.date_debut > today).sort((a, b) => a.date_debut.localeCompare(b.date_debut))[0];
          if (currentPhase && leagueId) {
            return <StartlistTrackerMovements phaseId={currentPhase.id} leagueId={leagueId} />;
          }
          return null;
        })()}
      </div>;
  }

  // VIEW MODE
  if (viewMode === "view") {
    if (viewLoading) {
      return <div className="p-4 space-y-4">
          {Array.from({
          length: 5
        }).map((_, i) => <Skeleton key={i} className="h-32 w-full rounded-2xl" />)}
        </div>;
    }
    if (!startlistViewData) {
      return <div className="p-4">
          <Button variant="ghost" onClick={() => setViewMode("list")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t('startlist.back')}
          </Button>
          <MobileEmptyState icon={<AlertCircle className="h-12 w-12" />} title={t('startlist.error')} description={t('startlist.loadError')} />
        </div>;
    }
    return <div className="pb-4">
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={() => setViewMode("list")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t('startlist.back')}
            </Button>
            <div className="flex items-center gap-2">
              {startlistViewData.pcs_validated && <Badge className="bg-green-600 text-white">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  SL officielle
                </Badge>}
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={handleShareStartlist} 
                disabled={isExporting}
                className="h-8 w-8"
              >
                {isExporting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Share2 className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>
            </div>
          </div>

          {/* Race info */}
          <div>
            <h2 className="text-xl font-bold">{startlistViewData.race.nom}</h2>
            <p className="text-sm text-muted-foreground">
              {format(new Date(startlistViewData.race.date_debut), "dd MMMM yyyy", {
              locale: dateLocale
            })} •{" "}
              {startlistViewData.race.categorie}
            </p>
          </div>

          {/* Section Parcours + Avis - Layout optimisé */}
          <div className="space-y-3">
            {/* Image du parcours - Multi-stage support */}
            {(startlistViewData.route_images?.length > 0 || startlistViewData.route_image_url) && (
              <RouteImageGallery
                images={startlistViewData.route_images || []}
                fallbackUrl={startlistViewData.route_image_url}
                onImageClick={() => setImageModalOpen(true)}
              />
            )}

            {/* L'avis du startlisteur - Sans espace vide */}
            {startlistViewData.admin_rating_note?.trim()?.length > 0 && <div className="bg-accent dark:bg-accent/20 border border-bordure-gold/30 dark:border-bordure-gold/20 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <MessageSquare className="h-4 w-4 text-primary" />
                  <h4 className="font-semibold text-sm">{t('startlist.startlisterOpinion')}</h4>
                </div>
                <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
                  "{startlistViewData.admin_rating_note}"
                  {startlistViewData.admin_rating_author && <span className="block mt-2 text-xs font-medium text-right italic">
                      — {startlistViewData.admin_rating_author}
                    </span>}
                </p>
              </div>}
          </div>

          {/* Barème de points - Optimisé pour courses à étapes */}
          {startlistViewData.scoring && startlistViewData.scoring.rules && startlistViewData.scoring.rules.length > 0 && <div className="space-y-2">
              {/* Barème Général */}
              {startlistViewData.scoring.rules.some((r: any) => r.type_classement === 'General') && <div className="bg-muted/50 rounded-xl p-3 border">
                  <h4 className="font-semibold text-xs mb-2">
                    {t('startlist.generalScale')} ({startlistViewData.scoring.categorie})
                  </h4>
                  <div className="grid grid-cols-5 gap-x-3 gap-y-1 text-xs">
                    {startlistViewData.scoring.rules.filter((r: any) => r.type_classement === 'General').slice(0, 10).map((rule: any) => <div key={`gc-${rule.place}`} className="flex gap-1">
                          <span className="font-medium">{rule.place}e:</span>
                          <span className="text-muted-foreground">{rule.points}pts</span>
                        </div>)}
                  </div>
                </div>}
              
              {/* Barème Étapes */}
              {startlistViewData.scoring.rules.some((r: any) => r.type_classement === 'Etape') && <div className="bg-primary/5 rounded-xl p-3 border border-primary/20">
                  <h4 className="font-semibold text-xs mb-2 text-primary">
                    {t('startlist.stageScale')}
                  </h4>
                  <div className="grid grid-cols-5 gap-x-3 gap-y-1 text-xs">
                    {startlistViewData.scoring.rules.filter((r: any) => r.type_classement === 'Etape').slice(0, 10).map((rule: any) => <div key={`stage-${rule.place}`} className="flex gap-1">
                          <span className="font-medium">{rule.place}e:</span>
                          <span className="text-muted-foreground">{rule.points}pts</span>
                        </div>)}
                  </div>
                </div>}
            </div>}

          {/* Le mot du startlisteur - Dernier */}
          {startlistViewData.startlisteur_note && <div className="bg-muted/30 border border-amber-300/30 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <MessageSquare className="h-4 w-4 text-amber-500" />
                <h4 className="font-semibold text-sm text-amber-700 dark:text-amber-400">
                  {t('startlist.startlisterNote')}
                </h4>
              </div>
              <p className="text-base text-foreground/80 whitespace-pre-wrap leading-relaxed">
                {startlistViewData.startlisteur_note}
              </p>
            </div>}

          {/* KPIs */}
          <KPIRow items={[{
          label: "Managers",
          value: startlistViewData.totals.managers,
          icon: <Users className="h-4 w-4" />
        }, {
          label: t('startlist.starters'),
          value: startlistViewData.totals.starters_all,
          icon: <Trophy className="h-4 w-4" />
        }]} />

          {/* Managers */}
          <div>
            <h3 className="text-lg font-semibold mb-3">{t('startlist.managersAtStart')}</h3>
            <Accordion type="multiple" value={Array.from(expandedManagers)} onValueChange={values => setExpandedManagers(new Set(values))} className="space-y-2">
              {startlistViewData.managers.map((manager: any) => {
              const sortedStarters = [...manager.starters].sort((a: any, b: any) => (b.cote || 0) - (a.cote || 0));
              return <AccordionItem key={manager.manager_id} value={manager.manager_id} className="border rounded-2xl px-3 bg-card">
                    <AccordionTrigger className="hover:no-underline py-3">
                      <div className="flex items-center gap-3 w-full">
                        {/* Maillot */}
                        {manager.jersey_image_url ? <img src={manager.jersey_image_url} alt="Maillot" className="h-12 w-12 object-contain flex-shrink-0" /> : <Avatar className="h-12 w-12 flex-shrink-0">
                            <AvatarFallback className="bg-primary/10">
                              {manager.manager_nom.split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
                            </AvatarFallback>
                          </Avatar>}
                        
                        {/* Infos manager */}
                        <div className="flex-1 min-w-0 text-left">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-sm truncate">
                              {manager.manager_nom}
                            </span>
                            <Badge variant="outline" className="text-xs flex-shrink-0">
                              {manager.starters_count} {t('startlist.riders')}
                            </Badge>
                          </div>
                          
                          {/* Equipe (sponsor) si disponible */}
                          {manager.sponsor && <p className="text-xs text-muted-foreground truncate">
                              {manager.sponsor}
                            </p>}
                          
                          {/* Etoiles + Classements */}
                          <div className="flex items-center justify-between gap-2 mt-1">
                            <ManagerStars avgStars={manager.avg_stars} votes={manager.votes} showVotes={manager.votes > 1} />
                            <div className="flex gap-2 text-xs text-muted-foreground">
                              <span>Ph: #{manager.rank_phase || "-"}{manager.points_phase > 0 && ` (${Math.round(manager.points_phase)}pts)`}</span>
                              <span>CG: #{manager.rank_total || "-"}{manager.points_total > 0 && ` (${Math.round(manager.points_total)}pts)`}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </AccordionTrigger>
                    
                    <AccordionContent>
                      <div className="pt-1">
                        {sortedStarters.map((starter: any) => <p key={starter.coureur_id} className="text-sm mx-[60px] text-muted-foreground flex items-center gap-1">
                            {starter.team_confirmed && (
                              <CheckCircle2 className="h-3 w-3 text-green-600 flex-shrink-0" />
                            )}
                            {starter.nom}
                          </p>)}
                      </div>
                    </AccordionContent>
                  </AccordionItem>;
            })}
            </Accordion>
          </div>

          {/* Sans propriétaire */}
          {startlistViewData.without_owner && startlistViewData.without_owner.length > 0 && <div className="rounded-xl bg-muted/50 p-4">
              <h4 className="font-semibold text-sm mb-2">
                {t('startlist.withoutOwner')} ({startlistViewData.without_owner.length})
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {startlistViewData.without_owner.map((coureur: any) => <Badge key={coureur.coureur_id} variant="outline" className="text-xs flex items-center gap-1">
                    {coureur.team_confirmed && (
                      <CheckCircle2 className="h-2.5 w-2.5 text-green-600" />
                    )}
                    {coureur.nom}
                  </Badge>)}
              </div>
            </div>}

          {/* Bouton Noter les managers */}
          {isAdmin && startlistViewData.managers.length > 0 && (
            <div className="mt-6 mb-4">
              <Button className="w-full touch-target" onClick={() => setShowRatingModal(true)}>
                <Star className="h-4 w-4 mr-2" />
                {t('startlist.rateManagers')}
              </Button>
            </div>
          )}
        </div>

        {/* Composant caché pour l'export desktop */}
        <div className="fixed left-[-9999px] top-0 w-[1200px] bg-white">
          {startlistViewData && <StartlistDesktopExport ref={exportRef} startlistData={startlistViewData} />}
        </div>


        {/* Modal de notation */}
        {isAdmin && startlistViewData.managers.length > 0 && <ManagerRatingModal open={showRatingModal} onOpenChange={setShowRatingModal} startlistId={selectedStartlistId!} leagueId={leagueId} managers={startlistViewData.managers} initialGlobalNote={startlistViewData.admin_rating_note || ""} onRatingsUpdated={() => queryClient.invalidateQueries({
        queryKey: ['startlist-view-mobile', selectedStartlistId]
      })} />}

        {/* Image modal */}
        <MobileBottomSheet open={imageModalOpen} onOpenChange={setImageModalOpen} title={t('startlist.route')}>
          <RouteImageGallery
            images={startlistViewData.route_images || []}
            fallbackUrl={startlistViewData.route_image_url}
          />
        </MobileBottomSheet>
      </div>;
  }
  return null;
};