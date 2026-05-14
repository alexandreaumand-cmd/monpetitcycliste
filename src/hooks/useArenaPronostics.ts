import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { isPast } from "date-fns";

export function useCurrentManagerId() {
  return useQuery({
    queryKey: ['current-manager-id'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase
        .from('managers')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
      return data?.id || null;
    },
    staleTime: Infinity,
  });
}

export interface PronosticDeadline {
  id: string;
  course_id: string;
  etape_numero: number | null;
  pronostic_type: string;
  deadline_at: string;
  is_ttt: boolean;
  courses: {
    nom: string;
    categorie: string | null;
    type_course: string | null;
    date_debut: string | null;
    date_fin: string | null;
  } | null;
}

export function usePronosticDeadlines(leagueId?: string | null) {
  return useQuery({
    queryKey: ['arena-pronostic-deadlines', leagueId ?? null],
    queryFn: async () => {
      // Get league scope (selected_course_ids) so per_course leagues only see their courses
      let scopedCourseIds: string[] | null = null;
      if (leagueId) {
        const { data: scope } = await supabase
          .from('league_scopes')
          .select('selected_course_ids')
          .eq('league_id', leagueId)
          .maybeSingle();
        const ids = (scope?.selected_course_ids as string[] | null) || null;
        if (ids && ids.length > 0) scopedCourseIds = ids;
      }

      let query = supabase
        .from('arena_pronostic_deadlines')
        .select('id, course_id, etape_numero, pronostic_type, deadline_at, is_ttt, courses(nom, categorie, type_course, date_debut, date_fin)')
        .order('deadline_at', { ascending: true });

      if (scopedCourseIds) {
        query = query.in('course_id', scopedCourseIds);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as PronosticDeadline[];
    },
  });
}

export interface MyPronostic {
  id: string;
  course_id: string;
  etape_numero: number | null;
  pronostic_type: string;
  coureur_id: string | null;
  equipe_saison_id: string | null;
  is_correct: boolean | null;
  evaluated_at: string | null;
  coureur_nom?: string;
  equipe_nom?: string;
}

export function useMyPronostics(leagueId: string, managerId: string | null) {
  return useQuery({
    queryKey: ['arena-my-pronostics', leagueId, managerId],
    queryFn: async () => {
      if (!managerId) return [];

      const { data, error } = await supabase
        .from('arena_pronostics')
        .select('id, course_id, etape_numero, pronostic_type, coureur_id, equipe_saison_id, is_correct, evaluated_at')
        .eq('league_id', leagueId)
        .eq('manager_id', managerId);

      if (error) throw error;
      if (!data || data.length === 0) return [];

      // Fetch coureur names for non-TTT pronostics
      const coureurIds = [...new Set(data.filter(p => p.coureur_id).map(p => p.coureur_id!))];
      const coureurMap: Record<string, string> = {};
      if (coureurIds.length > 0) {
        const { data: coureurs } = await supabase
          .from('coureurs')
          .select('id, nom')
          .in('id', coureurIds);
        for (const c of (coureurs || [])) {
          coureurMap[c.id] = c.nom;
        }
      }

      // Fetch equipe names for TTT pronostics
      const equipeSaisonIds = [...new Set(data.filter(p => p.equipe_saison_id).map(p => p.equipe_saison_id!))];
      const equipeMap: Record<string, string> = {};
      if (equipeSaisonIds.length > 0) {
        const { data: equipes } = await supabase
          .from('equipes_saisons')
          .select('id, nom_affiche')
          .in('id', equipeSaisonIds);
        for (const e of (equipes || [])) {
          equipeMap[e.id] = e.nom_affiche;
        }
      }

      return data.map(p => ({
        ...p,
        coureur_nom: p.coureur_id ? (coureurMap[p.coureur_id] || p.coureur_id) : undefined,
        equipe_nom: p.equipe_saison_id ? (equipeMap[p.equipe_saison_id] || undefined) : undefined,
      })) as MyPronostic[];
    },
    enabled: !!managerId && !!leagueId,
  });
}

export function useSavePronostic() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      leagueId: string;
      managerId: string;
      courseId: string;
      etapeNumero: number | null;
      pronosticType: string;
      coureurId?: string;
      equipeSaisonId?: string;
    }) => {
      // Check if a pronostic already exists
      let existingQuery = supabase
        .from('arena_pronostics')
        .select('id')
        .eq('league_id', params.leagueId)
        .eq('manager_id', params.managerId)
        .eq('course_id', params.courseId)
        .eq('pronostic_type', params.pronosticType);

      if (params.etapeNumero !== null) {
        existingQuery = existingQuery.eq('etape_numero', params.etapeNumero);
      } else {
        existingQuery = existingQuery.is('etape_numero', null);
      }

      const { data: existing } = await existingQuery.maybeSingle();

      const updatePayload: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };
      if (params.equipeSaisonId) {
        updatePayload.equipe_saison_id = params.equipeSaisonId;
        updatePayload.coureur_id = null;
      } else {
        updatePayload.coureur_id = params.coureurId;
        updatePayload.equipe_saison_id = null;
      }

      if (existing) {
        const { data, error } = await supabase
          .from('arena_pronostics')
          .update(updatePayload)
          .eq('id', existing.id)
          .select()
          .single();
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from('arena_pronostics')
          .insert({
            league_id: params.leagueId,
            manager_id: params.managerId,
            course_id: params.courseId,
            etape_numero: params.etapeNumero,
            pronostic_type: params.pronosticType,
            coureur_id: params.coureurId || null,
            equipe_saison_id: params.equipeSaisonId || null,
          })
          .select()
          .single();
        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['arena-my-pronostics'] });
    },
  });
}

export interface StandingsEntry {
  manager_id: string;
  manager_nom: string;
  avatar_url: string | null;
  correct_count: number;
  total_count: number;
}

export function usePronosticStandings(leagueId: string, courseId?: string | null) {
  return useQuery({
    queryKey: ['arena-pronostic-standings', leagueId, courseId ?? null],
    queryFn: async () => {
      if (!courseId) {
        const { data, error } = await supabase.rpc('get_arena_pronostic_standings', {
          p_league_id: leagueId,
        });
        if (error) throw error;
        return (data ?? []) as StandingsEntry[];
      }

      // Per-course aggregation, client-side
      const { data: pronos, error } = await supabase
        .from('arena_pronostics')
        .select('manager_id, is_correct')
        .eq('league_id', leagueId)
        .eq('course_id', courseId)
        .not('is_correct', 'is', null);

      if (error) throw error;
      if (!pronos || pronos.length === 0) return [];

      const agg: Record<string, { correct: number; total: number }> = {};
      for (const p of pronos) {
        const a = (agg[p.manager_id] ||= { correct: 0, total: 0 });
        a.total += 1;
        if (p.is_correct) a.correct += 1;
      }

      const managerIds = Object.keys(agg);
      const { data: managers } = await supabase
        .from('managers')
        .select('id, nom, avatar_url')
        .in('id', managerIds);

      const result: StandingsEntry[] = (managers || []).map((m) => ({
        manager_id: m.id,
        manager_nom: m.nom,
        avatar_url: m.avatar_url,
        correct_count: agg[m.id].correct,
        total_count: agg[m.id].total,
      }));

      result.sort((a, b) => b.correct_count - a.correct_count || b.total_count - a.total_count);
      return result;
    },
    enabled: !!leagueId,
    staleTime: 1000 * 60 * 2,
  });
}

export interface PronosticCourseOption {
  course_id: string;
  nom: string;
  date_debut: string | null;
}

export function usePronosticCoursesForLeague(leagueId: string) {
  return useQuery({
    queryKey: ['arena-pronostic-courses', leagueId],
    queryFn: async () => {
      // Get courses that have at least one deadline for this league.
      // This includes ongoing stage races even if no pronostics have been placed yet.
      const { data: deadlines, error } = await (supabase
        .from('arena_pronostic_deadlines')
        .select('course_id')
        .eq('league_id', leagueId) as unknown as Promise<{ data: { course_id: string }[] | null; error: any }>);
      if (error) throw error;
      const courseIds = [...new Set((deadlines || []).map((d) => d.course_id))];
      if (courseIds.length === 0) return [];

      const { data: courses } = await supabase
        .from('courses')
        .select('id, nom, date_debut')
        .in('id', courseIds);

      return (courses || [])
        .map((c) => ({ course_id: c.id, nom: c.nom, date_debut: c.date_debut }))
        .sort((a, b) => {
          const da = a.date_debut ? new Date(a.date_debut).getTime() : 0;
          const db = b.date_debut ? new Date(b.date_debut).getTime() : 0;
          return db - da;
        }) as PronosticCourseOption[];
    },
    enabled: !!leagueId,
    staleTime: 1000 * 60 * 5,
  });
}

export interface ManagerWinningPronostic {
  id: string;
  course_id: string;
  course_nom: string;
  etape_numero: number | null;
  pronostic_type: string;
  coureur_nom: string | null;
  equipe_nom: string | null;
  evaluated_at: string | null;
}

export function useManagerWinningPronostics(
  leagueId: string,
  managerId: string | null,
  courseId?: string | null,
  enabled: boolean = true,
) {
  return useQuery({
    queryKey: ['arena-manager-winning-pronostics', leagueId, managerId, courseId ?? null],
    queryFn: async () => {
      if (!managerId) return [];
      let query = supabase
        .from('arena_pronostics')
        .select('id, course_id, etape_numero, pronostic_type, coureur_id, equipe_saison_id, evaluated_at')
        .eq('league_id', leagueId)
        .eq('manager_id', managerId)
        .eq('is_correct', true);

      if (courseId) query = query.eq('course_id', courseId);

      const { data, error } = await query;
      if (error) throw error;
      if (!data || data.length === 0) return [];

      const courseIds = [...new Set(data.map((p) => p.course_id))];
      const coureurIds = [...new Set(data.filter((p) => p.coureur_id).map((p) => p.coureur_id!))];
      const equipeIds = [...new Set(data.filter((p) => p.equipe_saison_id).map((p) => p.equipe_saison_id!))];

      const [coursesRes, coureursRes, equipesRes] = await Promise.all([
        supabase.from('courses').select('id, nom').in('id', courseIds),
        coureurIds.length
          ? supabase.from('coureurs').select('id, nom').in('id', coureurIds)
          : Promise.resolve({ data: [] as { id: string; nom: string }[] }),
        equipeIds.length
          ? supabase.from('equipes_saisons').select('id, nom_affiche').in('id', equipeIds)
          : Promise.resolve({ data: [] as { id: string; nom_affiche: string }[] }),
      ]);

      const courseMap: Record<string, string> = {};
      for (const c of (coursesRes.data || []) as any[]) courseMap[c.id] = c.nom;
      const coureurMap: Record<string, string> = {};
      for (const c of (coureursRes.data || []) as any[]) coureurMap[c.id] = c.nom;
      const equipeMap: Record<string, string> = {};
      for (const e of (equipesRes.data || []) as any[]) equipeMap[e.id] = e.nom_affiche;

      return data
        .map((p) => ({
          id: p.id,
          course_id: p.course_id,
          course_nom: courseMap[p.course_id] || '—',
          etape_numero: p.etape_numero,
          pronostic_type: p.pronostic_type,
          coureur_nom: p.coureur_id ? coureurMap[p.coureur_id] || null : null,
          equipe_nom: p.equipe_saison_id ? equipeMap[p.equipe_saison_id] || null : null,
          evaluated_at: p.evaluated_at,
        }))
        .sort((a, b) => {
          const ta = a.evaluated_at ? new Date(a.evaluated_at).getTime() : 0;
          const tb = b.evaluated_at ? new Date(b.evaluated_at).getTime() : 0;
          return tb - ta;
        }) as ManagerWinningPronostic[];
    },
    enabled: enabled && !!leagueId && !!managerId,
    staleTime: 1000 * 60 * 2,
  });
}

export interface LeaguePronostic {
  manager_id: string;
  manager_nom: string;
  avatar_url: string | null;
  coureur_id: string | null;
  coureur_nom: string | null;
  equipe_saison_id: string | null;
  equipe_nom: string | null;
  is_correct: boolean | null;
}

export function useLeaguePronostics(
  leagueId: string,
  courseId: string,
  etapeNumero: number | null,
  pronosticType: string,
  enabled: boolean
) {
  return useQuery({
    queryKey: ['arena-league-pronostics', leagueId, courseId, etapeNumero, pronosticType],
    queryFn: async () => {
      let query = supabase
        .from('arena_pronostics')
        .select('manager_id, coureur_id, equipe_saison_id, is_correct')
        .eq('league_id', leagueId)
        .eq('course_id', courseId)
        .eq('pronostic_type', pronosticType);

      if (etapeNumero !== null) {
        query = query.eq('etape_numero', etapeNumero);
      } else {
        query = query.is('etape_numero', null);
      }

      const { data: pronostics, error } = await query;
      if (error) throw error;
      if (!pronostics || pronostics.length === 0) return [];

      // Fetch manager info
      const managerIds = [...new Set(pronostics.map(p => p.manager_id))];
      const { data: managers } = await supabase
        .from('managers')
        .select('id, nom, avatar_url')
        .in('id', managerIds);

      const managerMap: Record<string, { nom: string; avatar_url: string | null }> = {};
      for (const m of (managers || [])) {
        managerMap[m.id] = { nom: m.nom, avatar_url: m.avatar_url };
      }

      // Fetch coureur names
      const coureurIds = [...new Set(pronostics.filter(p => p.coureur_id).map(p => p.coureur_id!))];
      const coureurMap: Record<string, string> = {};
      if (coureurIds.length > 0) {
        const { data: coureurs } = await supabase
          .from('coureurs')
          .select('id, nom')
          .in('id', coureurIds);
        for (const c of (coureurs || [])) {
          coureurMap[c.id] = c.nom;
        }
      }

      // Fetch equipe names
      const equipeSaisonIds = [...new Set(pronostics.filter(p => p.equipe_saison_id).map(p => p.equipe_saison_id!))];
      const equipeMap: Record<string, string> = {};
      if (equipeSaisonIds.length > 0) {
        const { data: equipes } = await supabase
          .from('equipes_saisons')
          .select('id, nom_affiche')
          .in('id', equipeSaisonIds);
        for (const e of (equipes || [])) {
          equipeMap[e.id] = e.nom_affiche;
        }
      }

      return pronostics
        .map(p => ({
          manager_id: p.manager_id,
          manager_nom: managerMap[p.manager_id]?.nom || 'Inconnu',
          avatar_url: managerMap[p.manager_id]?.avatar_url || null,
          coureur_id: p.coureur_id,
          coureur_nom: p.coureur_id ? (coureurMap[p.coureur_id] || p.coureur_id) : null,
          equipe_saison_id: p.equipe_saison_id,
          equipe_nom: p.equipe_saison_id ? (equipeMap[p.equipe_saison_id] || null) : null,
          is_correct: p.is_correct,
        }))
        .sort((a, b) => a.manager_nom.localeCompare(b.manager_nom)) as LeaguePronostic[];
    },
    enabled: enabled && !!leagueId && !!courseId,
    staleTime: 1000 * 60 * 2,
  });
}

/**
 * Hook to check which closed deadlines have race results (position=1),
 * meaning evaluation has occurred even if the manager didn't make a pick.
 */
export function useEvaluatedDeadlineIds(deadlines: PronosticDeadline[] | undefined) {
  const closedDeadlines = useMemo(() => {
    if (!deadlines) return [];
    return deadlines.filter((d) => isPast(new Date(d.deadline_at)));
  }, [deadlines]);

  return useQuery({
    queryKey: ['arena-evaluated-deadline-ids', closedDeadlines.map(d => d.id).join(',')],
    queryFn: async () => {
      if (closedDeadlines.length === 0) return new Set<string>();

      const courseIds = [...new Set(closedDeadlines.map(d => d.course_id))];

      const { data: results, error } = await supabase
        .from('race_results')
        .select('course_id, etape_numero, type_classement')
        .in('course_id', courseIds)
        .eq('position', 1);

      if (error) throw error;

      const resultKeys = new Set<string>();
      for (const r of (results || [])) {
        resultKeys.add(`${r.course_id}|${r.etape_numero ?? 'null'}|${r.type_classement}`);
      }

      const pronosticToClassement: Record<string, string[]> = {
        stage_winner: ['Etape'],
        gc_winner: ['General'],
        one_day_winner: ['General', 'Etape'],
      };

      const evaluatedIds = new Set<string>();
      for (const d of closedDeadlines) {
        const classements = pronosticToClassement[d.pronostic_type] || [];
        const etapeKey = d.etape_numero ?? 'null';
        for (const tc of classements) {
          if (resultKeys.has(`${d.course_id}|${etapeKey}|${tc}`)) {
            evaluatedIds.add(d.id);
            break;
          }
        }
      }

      return evaluatedIds;
    },
    enabled: closedDeadlines.length > 0,
    staleTime: 1000 * 60 * 5,
  });
}

export interface StartlistRider {
  coureur_id: string;
  nom: string;
  team: string | null;
}

export function useStartlistRiders(courseId: string | null) {
  return useQuery({
    queryKey: ['arena-startlist-riders', courseId],
    queryFn: async () => {
      if (!courseId) return [];

      const { data: importData } = await supabase
        .from('startlist_imports')
        .select('id')
        .eq('race_id', courseId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!importData) return [];

      const { data: entries, error } = await supabase
        .from('startlist_entries')
        .select('coureur_id, source_name, source_team')
        .eq('startlist_id', importData.id)
        .not('coureur_id', 'is', null)
        .order('source_name');

      if (error) throw error;

      const coureurIds = (entries || []).map(e => e.coureur_id!).filter(Boolean);
      if (coureurIds.length === 0) return [];

      const { data: coureurs } = await supabase
        .from('coureurs')
        .select('id, nom')
        .in('id', coureurIds);

      const coureurMap: Record<string, string> = {};
      for (const c of (coureurs || [])) {
        coureurMap[c.id] = c.nom;
      }

      return (entries || [])
        .filter(e => e.coureur_id)
        .map(e => ({
          coureur_id: e.coureur_id!,
          nom: coureurMap[e.coureur_id!] || e.source_name,
          team: e.source_team,
        })) as StartlistRider[];
    },
    enabled: !!courseId,
    staleTime: 1000 * 60 * 10,
  });
}

export interface StartlistTeam {
  equipe_saison_id: string;
  nom_affiche: string;
}

export function useStartlistTeams(courseId: string | null) {
  return useQuery({
    queryKey: ['arena-startlist-teams', courseId],
    queryFn: async () => {
      if (!courseId) return [];

      // Find latest startlist import
      const { data: importData } = await supabase
        .from('startlist_imports')
        .select('id, saison_id')
        .eq('race_id', courseId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!importData) return [];

      // Get distinct source_team names from startlist
      const { data: entries, error } = await supabase
        .from('startlist_entries')
        .select('source_team')
        .eq('startlist_id', importData.id)
        .not('source_team', 'is', null);

      if (error) throw error;

      const uniqueTeamNames = [...new Set((entries || []).map(e => e.source_team).filter(Boolean))] as string[];
      if (uniqueTeamNames.length === 0) return [];

      // Fetch equipes_saisons for this season, match by nom_affiche or trigramme
      const { data: equipesSaisons } = await supabase
        .from('equipes_saisons')
        .select('id, nom_affiche, trigramme')
        .eq('saison_id', importData.saison_id)
        .eq('actif', true);

      if (!equipesSaisons || equipesSaisons.length === 0) return [];

      // Match source_team names to equipes_saisons
      const matched: StartlistTeam[] = [];
      const usedIds = new Set<string>();

      for (const teamName of uniqueTeamNames) {
        const lower = teamName.toLowerCase();
        const match = equipesSaisons.find(es =>
          !usedIds.has(es.id) && (
            es.nom_affiche.toLowerCase() === lower ||
            es.trigramme?.toLowerCase() === lower ||
            es.nom_affiche.toLowerCase().includes(lower) ||
            lower.includes(es.nom_affiche.toLowerCase())
          )
        );
        if (match) {
          usedIds.add(match.id);
          matched.push({ equipe_saison_id: match.id, nom_affiche: match.nom_affiche });
        }
      }

      return matched.sort((a, b) => a.nom_affiche.localeCompare(b.nom_affiche));
    },
    enabled: !!courseId,
    staleTime: 1000 * 60 * 10,
  });
}
