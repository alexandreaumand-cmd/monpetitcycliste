import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Trophy, Calendar, Search, Shirt } from "lucide-react";
import { useDebounce } from "use-debounce";
import { CourseResultsDrawer } from "@/components/courses/CourseResultsDrawer";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MobileCard, MobileEmptyState } from "@/components/mobile";
import { AdminMaintenance } from "@/components/admin/AdminMaintenance";
import { useSeasonContext } from "@/contexts/SeasonContext";
import { useManagerJerseys } from "@/hooks/useManagerJerseys";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useLeague } from "@/contexts/LeagueContext";
import { useDateLocale } from "@/hooks/useDateLocale";
import { format } from "date-fns";

interface Race {
  course_id: string;
  nom: string;
  categorie: string;
  date_debut: string;
  date_fin: string;
  last_result_at: string;
  types: string[];
}

interface ManagerPodium {
  manager_id: string;
  manager_nom: string;
  points: number;
  rank: number;
}

interface RaceWinner {
  coureur_nom: string;
}

interface Phase {
  id: string;
  index_dans_saison: number;
  date_debut: string;
  date_fin: string;
  statut: 'draft' | 'active' | 'completed' | 'auction_open' | 'auction_closed';
}

export const ResultsPageMobile = () => {
  const { t } = useTranslation('results');
  const dateLocale = useDateLocale();
  const { selectedSeason, phases, activePhase, isLoading: isLoadingContext } = useSeasonContext();
  const { leagueId } = useLeague();
  const [races, setRaces] = useState<Race[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch] = useDebounce(searchQuery, 300);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedPhaseId, setSelectedPhaseId] = useState<string | null>("global");
  const [podiums, setPodiums] = useState<Record<string, ManagerPodium[]>>({});
  const [winners, setWinners] = useState<Record<string, RaceWinner>>({});
  
  const allPodiumManagerIds = Object.values(podiums)
    .flatMap(p => p.slice(0, 3).map(m => m.manager_id))
    .filter(Boolean) as string[];
  const { data: jerseys = {} } = useManagerJerseys(allPodiumManagerIds, selectedSeason?.id);
  
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoadingContext) {
      loadRaces(true);
    }
  }, [selectedPhaseId, debouncedSearch, isLoadingContext, leagueId]);


  const loadRaces = async (reset = false) => {
    if (reset) {
      setLoading(true);
      setRaces([]);
    } else {
      setLoadingMore(true);
    }

    try {
      const currentOffset = reset ? 0 : races.length;
      
      const { data, error } = await supabase.functions.invoke('results-courses-with-entries', {
        body: { 
          search: debouncedSearch || null,
          limit: 24,
          offset: currentOffset,
          phase_id: selectedPhaseId === "global" ? null : selectedPhaseId,
          saison_id: selectedSeason?.id,
          league_id: leagueId
        }
      });

      if (error) throw error;
      
      const loadedRaces = data.races || [];
      
      if (reset) {
        setRaces(loadedRaces);
      } else {
        setRaces(prev => [...prev, ...loadedRaces]);
      }
      
      setHasMore(data.has_more || false);

      if (loadedRaces.length > 0) {
        const courseIds = loadedRaces.map((r: Race) => r.course_id);
        
        try {
          const [winnersResp, podiumsResp] = await Promise.all([
            supabase.functions.invoke('results-courses-podiums', {
              body: { 
                course_ids: courseIds,
                saison_id: selectedSeason?.id,
                league_id: leagueId
              }
            }),
            supabase.functions.invoke('courses-leaderboard-podiums', {
              body: { 
                course_ids: courseIds,
                league_id: leagueId
              }
            })
          ]);
          
          if (winnersResp.error) {
            console.error('Error loading winners:', winnersResp.error);
          } else if (winnersResp.data) {
            setWinners(prev => reset ? (winnersResp.data.winners || {}) : { ...prev, ...(winnersResp.data.winners || {}) });
          }
          
          if (podiumsResp.error) {
            console.error('Error loading podiums:', podiumsResp.error);
          } else if (podiumsResp.data) {
            setPodiums(prev => reset ? (podiumsResp.data.podiums || {}) : { ...prev, ...(podiumsResp.data.podiums || {}) });
            console.log(`Loaded podiums for ${Object.keys(podiumsResp.data.podiums || {}).length} courses`);
          }
        } catch (error) {
          console.error('Failed to load podiums/winners:', error);
        }
      }
    } catch (error) {
      console.error('Error loading races:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const openRaceDrawer = (race: Race) => {
    setSelectedCourseId(race.course_id);
    setDrawerOpen(true);
  };

  const getPhaseLabel = (phase: any) => {
    const start = format(new Date(phase.date_debut), 'MMM', { locale: dateLocale });
    const end = format(new Date(phase.date_fin), 'MMM', { locale: dateLocale });
    
    const today = new Date();
    const isActive = today >= new Date(phase.date_debut) && today <= new Date(phase.date_fin);
    
    return `${t('phase.label', { index: phase.index_dans_saison, start, end })}${isActive ? ` ${t('phase.active')}` : ''}`;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Admin Maintenance Component */}
      <div className="p-4">
        <AdminMaintenance />
      </div>
      
      {/* Header */}
      <div className="sticky top-14 z-10 bg-background border-b safe-top">
        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold">{t('title')}</h1>
            </div>
          </div>

          <Select value={selectedPhaseId || 'global'} onValueChange={setSelectedPhaseId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder={t('phase.select')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="global">
                🌍 {t('phase.global')}
              </SelectItem>
              {phases.map((phase) => (
                <SelectItem key={phase.id} value={phase.id}>
                  {getPhaseLabel(phase)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t('search.placeholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
      </div>

      {/* Liste des courses */}
      <div className="flex-1 overflow-y-auto p-4 pb-24 space-y-3">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-32 bg-muted rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : races.length === 0 ? (
          <MobileEmptyState
            icon={<Trophy className="h-16 w-16" />}
            title={t('empty.title')}
            description={searchQuery ? t('empty.description') : t('empty.noResults')}
            action={
              searchQuery ? (
                <Button variant="outline" onClick={() => setSearchQuery("")}>
                  {t('empty.reset')}
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            {races.map((race) => {
              const racePodium = podiums[race.course_id] || [];
              const raceWinner = winners[race.course_id];
              
              return (
                <MobileCard
                  key={race.course_id}
                  title={
                    <span className="text-base font-bold leading-snug line-clamp-2">
                      {race.nom}
                    </span>
                  }
                  subtitle={
                    <div className="flex items-center gap-2 text-muted-foreground mt-1">
                      <Calendar className="h-4 w-4" />
                      <span className="text-sm">
                        {format(new Date(race.date_debut), 'd MMM', { locale: dateLocale })}
                        {' → '}
                        {format(new Date(race.date_fin), 'd MMM', { locale: dateLocale })}
                      </span>
                    </div>
                  }
                  badge={
                    <Badge variant="secondary" className="text-xs font-semibold px-2.5 py-1">
                      {race.categorie}
                    </Badge>
                  }
                  onClick={() => openRaceDrawer(race)}
                >
                  {/* Winner section - more prominent */}
                  {raceWinner && (
                    <div className="flex items-center gap-2 mt-3 py-2.5 px-3 bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-950/30 dark:to-amber-950/30 rounded-xl border border-yellow-200/50 dark:border-yellow-800/50">
                      <Trophy className="h-5 w-5 text-yellow-500 flex-shrink-0" />
                      <span className="font-semibold text-sm text-foreground">{raceWinner.coureur_nom}</span>
                    </div>
                  )}
                  
                  {/* Manager podium - cleaner layout */}
                  {racePodium.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-border/50 space-y-2">
                      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                        {t('podium.managers')}
                      </div>
                      {racePodium.slice(0, 3).map((manager, idx) => (
                        <div 
                          key={manager.manager_nom} 
                          className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-muted/30 transition-colors"
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 flex items-center justify-center rounded-full bg-muted/50">
                              {jerseys[manager.manager_id] ? (
                                <img 
                                  src={jerseys[manager.manager_id]} 
                                  alt="Maillot" 
                                  className="h-5 w-5 object-contain" 
                                />
                              ) : (
                                <span className="text-base">
                                  {idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'}
                                </span>
                              )}
                            </div>
                            <span className="font-medium text-sm truncate max-w-[140px]">
                              {manager.manager_nom}
                            </span>
                          </div>
                          <span className="text-sm font-semibold text-primary tabular-nums">
                            {manager.points} pts
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </MobileCard>
              );
            })}

            {hasMore && (
              <div className="flex justify-center pt-4">
                <Button
                  onClick={() => loadRaces(false)}
                  disabled={loadingMore}
                  variant="outline"
                  className="w-full"
                >
                  {loadingMore ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {t('loading')}
                    </>
                  ) : (
                    t('loadMore')
                  )}
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      <CourseResultsDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        courseId={selectedCourseId}
      />
    </div>
  );
};
