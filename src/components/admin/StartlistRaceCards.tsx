import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { differenceInDays, format } from "date-fns";
import { fr } from "date-fns/locale";
import { Calendar, Trophy, Clock } from "lucide-react";
import { useLeague } from "@/contexts/LeagueContext";

interface StartlistRaceCardsProps {
  onRaceClick: (race: any, startlistId?: string) => void;
  isSuperAdmin?: boolean;
}

export const StartlistRaceCards = ({ onRaceClick, isSuperAdmin }: StartlistRaceCardsProps) => {
  const { leagueId } = useLeague() || { leagueId: null };
  const [tabMode, setTabMode] = useState<'30days' | '90days' | 'history' | 'upcoming-year'>('30days');

  // Fetch upcoming courses filtered by league scope
  const { data: upcomingCourses, isLoading: isLoadingCourses } = useQuery({
    queryKey: ['upcoming-courses-startlist', isSuperAdmin, leagueId, tabMode],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const in30Days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const in90Days = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      let courses: any[] = [];
      
      // SuperAdmin mode: Query all courses directly
      if (isSuperAdmin) {
        const { data: coursesData, error } = await supabase
          .from('courses')
          .select(`
            id,
            nom,
            categorie,
            type_course,
            date_debut,
            date_fin,
            phase_id,
            phases!inner(saison_id, index_dans_saison)
          `)
          .order('date_debut', { ascending: false });
          
        if (error) throw error;
        
        courses = (coursesData || []).map((c: any) => ({
          course_id: c.id,
          id: c.id,
          nom: c.nom,
          categorie: c.categorie,
          type_course: c.type_course,
          date_debut: c.date_debut,
          date_fin: c.date_fin,
          phase_id: c.phase_id,
          phase_index: c.phases.index_dans_saison,
          nb_etapes_estimees: null
        }));
      } else {
        // Manager mode: Use league-scoped courses
        if (!leagueId) return [];
        
        const { data: leagueCourses, error: edgeFnError } = await supabase.functions.invoke(
          'get-league-courses',
          { body: { league_id: leagueId, season_id: null } }
        );
        
        if (edgeFnError) throw edgeFnError;

        const raw = leagueCourses?.courses || [];
        courses = raw.map((c: any) => ({ ...c, id: c.course_id }));
      }
      
      // Filter by tab mode
      let filtered = courses;
      if (tabMode === 'history') {
        filtered = courses.filter((c: any) => c.date_fin < today)
          .sort((a: any, b: any) => b.date_fin.localeCompare(a.date_fin));
      } else if (tabMode === '30days') {
        filtered = courses.filter((c: any) => 
          c.date_fin >= today && c.date_debut <= in30Days
        ).sort((a: any, b: any) => a.date_debut.localeCompare(b.date_debut));
      } else if (tabMode === '90days') {
        filtered = courses.filter((c: any) => 
          c.date_fin >= today && c.date_debut <= in90Days
        ).sort((a: any, b: any) => a.date_debut.localeCompare(b.date_debut));
      } else if (tabMode === 'upcoming-year') {
        filtered = courses.filter((c: any) => c.date_fin >= today)
          .sort((a: any, b: any) => a.date_debut.localeCompare(b.date_debut));
      }
      
      return filtered;
    },
    enabled: isSuperAdmin || !!leagueId
  });

  // Check if startlist exists for a race, with last modification date and rider count
  const { data: existingStartlists } = useQuery({
    queryKey: ['startlist-imports-with-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('startlist_imports')
        .select('id, race_id, created_at, pcs_validated, startlist_entries(id, created_at)')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      // Aggregate stats per startlist
      return (data || []).map((sl: any) => {
        const entries = sl.startlist_entries || [];
        const lastEntryDate = entries.length > 0
          ? entries.reduce((latest: string, e: any) => e.created_at > latest ? e.created_at : latest, entries[0].created_at)
          : null;
        return {
          id: sl.id,
          race_id: sl.race_id,
          created_at: sl.created_at,
          pcs_validated: sl.pcs_validated,
          last_modified: lastEntryDate || sl.created_at,
          rider_count: entries.length,
        };
      });
    }
  });

  const normalizeId = (v?: string | null) => (v ?? '').trim().toLowerCase();

  const hasStartlist = (raceId: string) => {
    const rid = normalizeId(raceId);
    return existingStartlists?.some(s => normalizeId(s.race_id) === rid) || false;
  };

  const isPcsValidated = (raceId: string) => {
    const rid = normalizeId(raceId);
    return existingStartlists?.some(
      (s: any) => normalizeId(s.race_id) === rid && s.pcs_validated === true
    ) || false;
  };

  const getStartlistId = (raceId: string) => {
    const rid = normalizeId(raceId);
    const matchingStartlists = existingStartlists?.filter(sl => normalizeId(sl.race_id) === rid);
    if (!matchingStartlists || matchingStartlists.length === 0) return undefined;
    return matchingStartlists[0].id;
  };

  const getStartlistInfo = (raceId: string) => {
    const rid = normalizeId(raceId);
    const matchingStartlist = existingStartlists?.find(sl => normalizeId(sl.race_id) === rid);
    if (!matchingStartlist) return null;
    return {
      lastModified: matchingStartlist.last_modified,
      riderCount: matchingStartlist.rider_count,
    };
  };

  return (
    <div className="space-y-4">
      <Tabs value={tabMode} onValueChange={(v) => setTabMode(v as '30days' | '90days' | 'history' | 'upcoming-year')}>
        <TabsList className="w-full max-w-2xl overflow-x-auto scrollbar-hide flex">
          <TabsTrigger value="history" className="shrink-0 text-xs sm:text-sm whitespace-nowrap">Historique</TabsTrigger>
          <TabsTrigger value="30days" className="shrink-0 text-xs sm:text-sm whitespace-nowrap">30 jours</TabsTrigger>
          <TabsTrigger value="90days" className="shrink-0 text-xs sm:text-sm whitespace-nowrap">90 jours</TabsTrigger>
          <TabsTrigger value="upcoming-year" className="shrink-0 text-xs sm:text-sm whitespace-nowrap">Année à venir</TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoadingCourses ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {[...Array(6)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2 mt-2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : upcomingCourses && upcomingCourses.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {upcomingCourses
            .filter((course: any) => {
              if (tabMode === 'history') {
                return hasStartlist(course.id);
              }
              return true;
            })
            .map((course: any) => {
              const dateDebut = new Date(course.date_debut);
              const dateFin = new Date(course.date_fin);
              const today = new Date().toISOString().split('T')[0];
              const todayDate = new Date(today);
              
                const isOngoing = course.date_debut <= today && course.date_fin >= today;
                const daysUntil = differenceInDays(dateDebut, todayDate);
                const startlistExists = hasStartlist(course.id);
                const pcsValidated = isPcsValidated(course.id);
                const startlistInfo = getStartlistInfo(course.id);
                
                return (
                  <Card 
                    key={course.id} 
                    className="cursor-pointer hover:shadow-lg transition-shadow"
                    onClick={() => {
                      const startlistId = getStartlistId(course.id);
                      onRaceClick(course, startlistId);
                    }}
                  >
                    <CardContent className="p-3 sm:p-4 space-y-2">
                      {/* Row 1: Race name — full width, wraps naturally */}
                      <div className="flex items-start gap-2">
                        <h3 className="text-sm sm:text-base font-semibold leading-snug flex-1 min-w-0">
                          {course.nom}
                        </h3>
                        {daysUntil >= 0 && tabMode !== 'history' && (
                          <span className="text-[11px] text-muted-foreground whitespace-nowrap shrink-0 mt-0.5">
                            J-{daysUntil}
                          </span>
                        )}
                      </div>

                      {/* Row 2: Status badges — compact, wrap allowed */}
                      <div className="flex flex-wrap items-center gap-1">
                        {isOngoing && (
                          <Badge className="bg-primary text-primary-foreground border-primary text-[10px] px-1.5 py-0">
                            En cours
                          </Badge>
                        )}
                        {course.categorie && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            {course.categorie}
                          </Badge>
                        )}
                        {startlistExists && (
                          <Badge variant="outline" className="border-primary text-primary text-[10px] px-1.5 py-0">
                            {startlistInfo ? `${startlistInfo.riderCount}` : 'SL'}
                          </Badge>
                        )}
                        {pcsValidated && (
                          <Badge className="bg-green-600 text-white border-green-600 text-[10px] px-1.5 py-0">
                            ✓ SL officielle
                          </Badge>
                        )}
                      </div>

                      {/* Row 3: Date + meta — single compact line */}
                      <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3 shrink-0" />
                          {format(dateDebut, 'd MMM', { locale: fr })} – {format(dateFin, 'd MMM yyyy', { locale: fr })}
                        </span>
                        {course.nb_etapes_estimees && course.nb_etapes_estimees > 1 && (
                          <span>{course.nb_etapes_estimees} ét.</span>
                        )}
                      </div>

                      {startlistInfo && (
                        <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                          <Clock className="h-3 w-3 shrink-0" />
                          <span>Modifié {format(new Date(startlistInfo.lastModified), 'd MMM yyyy HH:mm', { locale: fr })}</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
        </div>
      ) : (
        <Card className="p-12">
          <p className="text-center text-muted-foreground">
            Aucune course trouvée pour cette période
          </p>
        </Card>
      )}
    </div>
  );
};
