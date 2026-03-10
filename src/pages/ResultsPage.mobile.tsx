import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Trophy, Search } from "lucide-react";
import { useDebounce } from "use-debounce";
import { CourseResultsDrawer } from "@/components/courses/CourseResultsDrawer";
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
  const {
    t
  } = useTranslation('results');
  const dateLocale = useDateLocale();
  const {
    selectedSeason,
    phases,
    activePhase,
    isLoading: isLoadingContext
  } = useSeasonContext();
  const {
    leagueId
  } = useLeague();
  const [races, setRaces] = useState<Race[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch] = useDebounce(searchQuery, 300);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [podiums, setPodiums] = useState<Record<string, ManagerPodium[]>>({});
  const [winners, setWinners] = useState<Record<string, RaceWinner>>({});
  const allPodiumManagerIds = Object.values(podiums).flatMap(p => p.slice(0, 3).map(m => m.manager_id)).filter(Boolean) as string[];
  const {
    data: jerseys = {}
  } = useManagerJerseys(allPodiumManagerIds, selectedSeason?.id);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  
  // URL params for deep linking from notifications
  const [searchParams, setSearchParams] = useSearchParams();
  const courseIdFromUrl = searchParams.get('courseId');

  // Open drawer automatically if courseId is in URL
  useEffect(() => {
    if (courseIdFromUrl) {
      setSelectedCourseId(courseIdFromUrl);
      setDrawerOpen(true);
      // Clean up URL after opening
      searchParams.delete('courseId');
      setSearchParams(searchParams, { replace: true });
    }
  }, [courseIdFromUrl]);

  useEffect(() => {
    if (!isLoadingContext && leagueId) {
      loadRaces(true);
    }
  }, [debouncedSearch, isLoadingContext, leagueId]);
  const loadRaces = async (reset = false) => {
    if (reset) {
      setLoading(true);
      setRaces([]);
    } else {
      setLoadingMore(true);
    }
    try {
      const currentOffset = reset ? 0 : races.length;
      const {
        data,
        error
      } = await supabase.functions.invoke('results-courses-with-entries', {
        body: {
          search: debouncedSearch || null,
          limit: 24,
          offset: currentOffset,
          phase_id: null,
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

      // Load podiums and winners - single call (results-courses-podiums returns both)
      if (loadedRaces.length > 0) {
        const courseIds = loadedRaces.map((r: Race) => r.course_id);
        try {
          const {
            data,
            error
          } = await supabase.functions.invoke('results-courses-podiums', {
            body: {
              course_ids: courseIds,
              saison_id: selectedSeason?.id,
              league_id: leagueId
            }
          });
          if (error) {
            console.error('Error loading podiums/winners:', error);
          } else if (data) {
            setWinners(prev => reset ? data.winners || {} : {
              ...prev,
              ...(data.winners || {})
            });
            setPodiums(prev => reset ? data.podiums || {} : {
              ...prev,
              ...(data.podiums || {})
            });
            console.log(`Loaded podiums for ${Object.keys(data.podiums || {}).length} courses`);
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
  return <div className="flex flex-col h-full">
      {/* Admin Maintenance Component */}
      <div className="p-4 px-0 py-0">
        <AdminMaintenance />
      </div>
      
      {/* Header */}
      <div className="sticky top-14 z-10 bg-background border-b safe-top">
        <div className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder={t('search.placeholder')} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9" />
          </div>
        </div>
      </div>

      {/* Liste des courses */}
      <div className="flex-1 overflow-y-auto p-4 pb-24 space-y-3">
        {loading ? <div className="space-y-3">
            {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-32 bg-muted rounded-2xl animate-pulse" />)}
          </div> : races.length === 0 ? <MobileEmptyState icon={<Trophy className="h-16 w-16" />} title={t('empty.title')} description={searchQuery ? t('empty.description') : t('empty.noResults')} action={searchQuery ? <Button variant="outline" onClick={() => setSearchQuery("")}>
                  {t('empty.reset')}
                </Button> : undefined} /> : <>
            {races.map(race => {
          const racePodium = podiums[race.course_id] || [];
          const raceWinner = winners[race.course_id];
          return <MobileCard key={race.course_id} title={<span className="text-base font-bold leading-snug line-clamp-2">
                      {race.nom}
                    </span>} subtitle={<span className="text-xs text-muted-foreground/70">
                      {race.date_debut === race.date_fin ? format(new Date(race.date_debut), 'd MMM', {
              locale: dateLocale
            }) : `${format(new Date(race.date_debut), 'd MMM', {
              locale: dateLocale
            })} - ${format(new Date(race.date_fin), 'd MMM', {
              locale: dateLocale
            })}`}
                    </span>} badge={<Badge variant="secondary" className="text-xs font-semibold px-2.5 py-1">
                      {race.categorie}
                    </Badge>} onClick={() => openRaceDrawer(race)}>
                  {/* Winner section */}
                  {raceWinner && <div className="flex items-center gap-2 mt-3">
                      <Trophy className="h-4 w-4 text-yellow-500 flex-shrink-0" />
                      <span className="font-medium text-sm text-foreground">{raceWinner.coureur_nom}</span>
                    </div>}
                  
                  {/* Manager podium */}
                  {racePodium.length > 0 && <div className="mt-3 pt-3 border-t border-border/50">
                      {racePodium.slice(0, 3).map((manager, idx) => <div key={manager.manager_nom} className="flex items-center justify-between py-1">
                          <div className="flex items-center gap-2">
                            {jerseys[manager.manager_id] ? <img src={jerseys[manager.manager_id]} alt={`Maillot de ${manager.manager_nom}`} className="h-5 w-5 object-contain" loading="lazy" width={20} height={20} /> : <span className="text-sm">
                                {idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'}
                              </span>}
                            <span className="text-sm text-muted-foreground truncate max-w-[140px]">
                              {manager.manager_nom}
                            </span>
                          </div>
                          <span className="text-sm font-medium tabular-nums">
                            {Math.round(manager.points)} pts
                          </span>
                        </div>)}
                    </div>}
                </MobileCard>;
        })}

            {hasMore && <div className="flex justify-center pt-4">
                <Button onClick={() => loadRaces(false)} disabled={loadingMore} variant="outline" className="w-full">
                  {loadingMore ? <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {t('loading')}
                    </> : t('loadMore')}
                </Button>
              </div>}
          </>}
      </div>

      <CourseResultsDrawer open={drawerOpen} onOpenChange={setDrawerOpen} courseId={selectedCourseId} />
    </div>;
};