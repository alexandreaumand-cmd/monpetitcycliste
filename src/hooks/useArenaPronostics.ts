import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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
  courses: {
    nom: string;
    categorie: string | null;
    type_course: string | null;
    date_debut: string | null;
    date_fin: string | null;
  } | null;
}

export function usePronosticDeadlines() {
  return useQuery({
    queryKey: ['arena-pronostic-deadlines'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('arena_pronostic_deadlines')
        .select('id, course_id, etape_numero, pronostic_type, deadline_at, courses(nom, categorie, type_course, date_debut, date_fin)')
        .order('deadline_at', { ascending: true });
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
  coureur_id: string;
  is_correct: boolean | null;
  evaluated_at: string | null;
  coureur_nom?: string;
}

export function useMyPronostics(leagueId: string, managerId: string | null) {
  return useQuery({
    queryKey: ['arena-my-pronostics', leagueId, managerId],
    queryFn: async () => {
      if (!managerId) return [];

      const { data, error } = await supabase
        .from('arena_pronostics')
        .select('id, course_id, etape_numero, pronostic_type, coureur_id, is_correct, evaluated_at')
        .eq('league_id', leagueId)
        .eq('manager_id', managerId);

      if (error) throw error;
      if (!data || data.length === 0) return [];

      // Fetch coureur names separately
      const coureurIds = [...new Set(data.map(p => p.coureur_id))];
      const { data: coureurs } = await supabase
        .from('coureurs')
        .select('id, nom')
        .in('id', coureurIds);

      const coureurMap: Record<string, string> = {};
      for (const c of (coureurs || [])) {
        coureurMap[c.id] = c.nom;
      }

      return data.map(p => ({
        ...p,
        coureur_nom: coureurMap[p.coureur_id] || p.coureur_id,
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
      coureurId: string;
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

      if (existing) {
        // Update existing pronostic
        const { data, error } = await supabase
          .from('arena_pronostics')
          .update({
            coureur_id: params.coureurId,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id)
          .select()
          .single();
        if (error) throw error;
        return data;
      } else {
        // Insert new pronostic
        const { data, error } = await supabase
          .from('arena_pronostics')
          .insert({
            league_id: params.leagueId,
            manager_id: params.managerId,
            course_id: params.courseId,
            etape_numero: params.etapeNumero,
            pronostic_type: params.pronosticType,
            coureur_id: params.coureurId,
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

export function usePronosticStandings(leagueId: string) {
  return useQuery({
    queryKey: ['arena-pronostic-standings', leagueId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('arena-pronostic-standings', {
        body: { league_id: leagueId },
      });
      if (error) throw error;
      return (data?.standings || []) as StandingsEntry[];
    },
    enabled: !!leagueId,
    staleTime: 1000 * 60 * 2,
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

      // Find latest startlist import for this course
      const { data: importData } = await supabase
        .from('startlist_imports')
        .select('id')
        .eq('race_id', courseId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!importData) return [];

      // Fetch entries with matched riders
      const { data: entries, error } = await supabase
        .from('startlist_entries')
        .select('coureur_id, source_name, source_team')
        .eq('startlist_id', importData.id)
        .not('coureur_id', 'is', null)
        .order('source_name');

      if (error) throw error;

      // Fetch coureur names
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
