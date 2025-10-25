import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { differenceInDays, format } from "date-fns";
import { fr } from "date-fns/locale";
import { Calendar, Trophy } from "lucide-react";
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

  // Check if startlist exists for a race
  const { data: existingStartlists } = useQuery({
    queryKey: ['startlist-imports'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('startlist_imports')
        .select('id, race_id, created_at, pcs_validated')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
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

  return (
    <div className="space-y-6">
      <Tabs value={tabMode} onValueChange={(v) => setTabMode(v as '30days' | '90days' | 'history' | 'upcoming-year')}>
        <TabsList className="grid w-full max-w-2xl grid-cols-4">
          <TabsTrigger value="history">Historique</TabsTrigger>
          <TabsTrigger value="30days">30 jours</TabsTrigger>
          <TabsTrigger value="90days">90 jours</TabsTrigger>
          <TabsTrigger value="upcoming-year">Année à venir</TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoadingCourses ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
              
              return (
                <Card 
                  key={course.id} 
                  className="cursor-pointer hover:shadow-lg transition-shadow"
                  onClick={() => {
                    const startlistId = getStartlistId(course.id);
                    onRaceClick(course, startlistId);
                  }}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between mb-2">
                      <CardTitle className="text-base font-semibold leading-tight pr-2">
                        {course.nom}
                      </CardTitle>
                      <Trophy className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    </div>
                    
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {isOngoing && (
                        <Badge className="bg-red-600 text-white border-red-600">
                          EN COURS
                        </Badge>
                      )}
                      {startlistExists && (
                        <Badge variant="outline" className="border-primary text-primary">
                          Startlist
                        </Badge>
                      )}
                      {pcsValidated && (
                        <Badge className="bg-green-600 text-white border-green-600">
                          PCS OK
                        </Badge>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2 text-xs">
                      <Badge variant="secondary">
                        Phase {course.phase_index}
                      </Badge>
                      {course.categorie && (
                        <Badge variant="outline">{course.categorie}</Badge>
                      )}
                      {course.type_course && (
                        <Badge variant="outline">{course.type_course}</Badge>
                      )}
                    </div>
                  </CardHeader>

                  <CardContent className="pt-0 space-y-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4 flex-shrink-0" />
                      <span className="text-xs">
                        {format(dateDebut, 'd MMM', { locale: fr })} - {format(dateFin, 'd MMM yyyy', { locale: fr })}
                      </span>
                    </div>
                    
                    {daysUntil >= 0 && tabMode !== 'history' && (
                      <Badge variant="outline" className="text-xs">
                        J-{daysUntil}
                      </Badge>
                    )}
                    
                    {course.nb_etapes_estimees && course.nb_etapes_estimees > 1 && (
                      <p className="text-xs text-muted-foreground">
                        {course.nb_etapes_estimees} étapes
                      </p>
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
