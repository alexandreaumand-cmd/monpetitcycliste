import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// ─── Types ───────────────────────────────────────────────────────

export interface ArenaPoll {
  id: string;
  league_id: string;
  poll_type: string;
  title: string;
  description: string | null;
  options_type: string;
  closes_at: string;
  is_active: boolean;
  created_by: string;
  created_at: string;
}

export interface PollOption {
  id: string;
  poll_id: string;
  label: string;
  manager_id: string | null;
  sort_order: number;
}

export interface PollVote {
  id: string;
  poll_id: string;
  voter_manager_id: string;
  option_id: string;
  created_at: string;
}

export interface PollWithDetails extends ArenaPoll {
  options: PollOption[];
  myVote: PollVote | null;
  voteCounts: Record<string, number>;
  totalVotes: number;
}

export const POLL_TYPES = [
  { value: "mvp", labelKey: "votes.pollTypes.mvp" },
  { value: "flop", labelKey: "votes.pollTypes.flop" },
  { value: "best_move", labelKey: "votes.pollTypes.bestMove" },
  { value: "worst_buy", labelKey: "votes.pollTypes.worstBuy" },
  { value: "custom", labelKey: "votes.pollTypes.custom" },
] as const;

// ─── Hooks ───────────────────────────────────────────────────────

export const useCurrentManagerId = () => {
  return useQuery({
    queryKey: ["current-manager-id"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase
        .from("managers")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      return data?.id || null;
    },
    staleTime: 1000 * 60 * 10,
  });
};

export const useLeagueManagers = (leagueId: string) => {
  return useQuery({
    queryKey: ["league-managers-for-polls", leagueId],
    queryFn: async () => {
      // Get user_ids from league_members
      const { data: members, error: membersError } = await supabase
        .from("league_members")
        .select("user_id")
        .eq("league_id", leagueId);
      if (membersError) throw membersError;
      if (!members?.length) return [];

      const userIds = members.map((m) => m.user_id);
      const { data: managers, error: managersError } = await supabase
        .from("managers")
        .select("id, nom, avatar_url")
        .in("user_id", userIds);
      if (managersError) throw managersError;
      return managers || [];
    },
    enabled: !!leagueId,
  });
};

export const useArenaPolls = (leagueId: string, managerId: string | null) => {
  return useQuery({
    queryKey: ["arena-polls", leagueId, managerId],
    queryFn: async () => {
      // 1. Fetch polls for the league
      const { data: polls, error: pollsError } = await supabase
        .from("arena_polls")
        .select("*")
        .eq("league_id", leagueId)
        .eq("is_active", true)
        .order("closes_at", { ascending: false });
      if (pollsError) throw pollsError;
      if (!polls?.length) return [];

      const pollIds = polls.map((p) => p.id);

      // 2. Fetch all options for these polls
      const { data: options, error: optionsError } = await supabase
        .from("arena_poll_options")
        .select("*")
        .in("poll_id", pollIds)
        .order("sort_order", { ascending: true });
      if (optionsError) throw optionsError;

      // 3. Fetch votes (own votes always visible, others after close)
      const { data: votes, error: votesError } = await supabase
        .from("arena_poll_votes")
        .select("*")
        .in("poll_id", pollIds);
      if (votesError) throw votesError;

      // 4. Build enriched poll objects
      const enriched: PollWithDetails[] = polls.map((poll) => {
        const pollOptions = (options || []).filter((o) => o.poll_id === poll.id);
        const pollVotes = (votes || []).filter((v) => v.poll_id === poll.id);
        const myVote = managerId
          ? pollVotes.find((v) => v.voter_manager_id === managerId) || null
          : null;

        const voteCounts: Record<string, number> = {};
        pollOptions.forEach((o) => { voteCounts[o.id] = 0; });
        pollVotes.forEach((v) => {
          voteCounts[v.option_id] = (voteCounts[v.option_id] || 0) + 1;
        });

        return {
          ...poll,
          options: pollOptions,
          myVote,
          voteCounts,
          totalVotes: pollVotes.length,
        };
      });

      return enriched;
    },
    enabled: !!leagueId,
  });
};

// ─── Mutations ───────────────────────────────────────────────────

export const useVote = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      pollId,
      optionId,
      managerId,
    }: {
      pollId: string;
      optionId: string;
      managerId: string;
    }) => {
      const { error } = await supabase.from("arena_poll_votes").insert({
        poll_id: pollId,
        option_id: optionId,
        voter_manager_id: managerId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["arena-polls"] });
    },
  });
};

export const useCreatePoll = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      leagueId,
      managerId,
      pollType,
      title,
      description,
      closesAt,
      optionsType,
      customOptions,
      managerOptions,
    }: {
      leagueId: string;
      managerId: string;
      pollType: string;
      title: string;
      description?: string;
      closesAt: string;
      optionsType: "managers" | "custom";
      customOptions?: string[];
      managerOptions?: { id: string; nom: string }[];
    }) => {
      // 1. Create the poll
      const { data: poll, error: pollError } = await supabase
        .from("arena_polls")
        .insert({
          league_id: leagueId,
          poll_type: pollType,
          title,
          description: description || null,
          options_type: optionsType,
          closes_at: closesAt,
          created_by: managerId,
        })
        .select("id")
        .single();
      if (pollError) throw pollError;

      // 2. Create options
      const optionsToInsert: Array<{
        poll_id: string;
        label: string;
        manager_id?: string;
        sort_order: number;
      }> = [];

      if (optionsType === "managers" && managerOptions) {
        managerOptions.forEach((m, i) => {
          optionsToInsert.push({
            poll_id: poll.id,
            label: m.nom,
            manager_id: m.id,
            sort_order: i,
          });
        });
      } else if (optionsType === "custom" && customOptions) {
        customOptions.forEach((label, i) => {
          optionsToInsert.push({
            poll_id: poll.id,
            label,
            sort_order: i,
          });
        });
      }

      if (optionsToInsert.length > 0) {
        const { error: optError } = await supabase
          .from("arena_poll_options")
          .insert(optionsToInsert);
        if (optError) throw optError;
      }

      return poll;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["arena-polls"] });
    },
  });
};

export const useDeletePoll = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (pollId: string) => {
      // Delete options first (cascade should handle this but let's be safe)
      await supabase.from("arena_poll_options").delete().eq("poll_id", pollId);
      const { error } = await supabase.from("arena_polls").delete().eq("id", pollId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["arena-polls"] });
    },
  });
};
