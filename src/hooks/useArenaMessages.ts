import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";

const PAGE_SIZE = 30;

// ── Types ──────────────────────────────────────────────

export interface ArenaMessage {
  id: string;
  channel_id: string;
  league_id: string;
  author_manager_id: string | null;
  message_type: string;
  content: string;
  metadata: any;
  source_message_id: string | null;
  created_at: string;
  course_id?: string | null;
  author?: {
    id: string;
    nom: string;
    avatar_url: string | null;
  } | null;
}

export interface ReactionSummary {
  emoji: string;
  count: number;
  hasReacted: boolean;
}

export interface LeagueManager {
  id: string;
  nom: string;
  avatar_url: string | null;
}

// ── Channels ───────────────────────────────────────────

export function useArenaChannels(leagueId: string) {
  return useQuery({
    queryKey: ["arena-channels", leagueId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("arena_channels")
        .select("id, slug, league_id")
        .eq("league_id", leagueId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!leagueId,
  });
}

// ── Messages (infinite scroll) ─────────────────────────

export function useArenaMessages(
  channelId: string | null,
  leagueId: string,
  courseId?: string | null
) {
  return useInfiniteQuery({
    queryKey: ["arena-messages", channelId, leagueId, courseId ?? "all"],
    queryFn: async ({ pageParam = 0 }) => {
      if (!channelId) return { messages: [], nextOffset: null };

      let query = supabase
        .from("arena_messages")
        .select(
          `id, channel_id, league_id, author_manager_id, message_type,
           content, metadata, source_message_id, created_at, course_id,
           author:managers!arena_messages_author_manager_id_fkey(id, nom, avatar_url)`
        )
        .eq("channel_id", channelId)
        .eq("league_id", leagueId)
        .order("created_at", { ascending: false })
        .range(pageParam, pageParam + PAGE_SIZE - 1);

      // Filter by course_id when provided (for live-courses sub-channels)
      if (courseId) {
        query = query.eq("course_id", courseId);
      }

      const { data, error } = await query;
      if (error) throw error;

      return {
        messages: (data || []) as unknown as ArenaMessage[],
        nextOffset:
          data && data.length === PAGE_SIZE ? pageParam + PAGE_SIZE : null,
      };
    },
    getNextPageParam: (lastPage) => lastPage.nextOffset,
    enabled: !!channelId && !!leagueId,
    initialPageParam: 0,
  });
}

// ── Reactions (grouped by message) ─────────────────────

export function useMessageReactions(
  messageIds: string[],
  currentManagerId: string | null
) {
  return useQuery({
    queryKey: ["arena-reactions", ...messageIds.slice(0, 5), messageIds.length],
    queryFn: async () => {
      if (!messageIds.length) return {};

      const { data, error } = await supabase
        .from("arena_reactions")
        .select("id, message_id, manager_id, emoji")
        .in("message_id", messageIds);

      if (error) throw error;

      const grouped: Record<string, ReactionSummary[]> = {};

      for (const r of data || []) {
        if (!grouped[r.message_id]) grouped[r.message_id] = [];

        const existing = grouped[r.message_id].find(
          (s) => s.emoji === r.emoji
        );
        if (existing) {
          existing.count++;
          if (r.manager_id === currentManagerId) existing.hasReacted = true;
        } else {
          grouped[r.message_id].push({
            emoji: r.emoji,
            count: 1,
            hasReacted: r.manager_id === currentManagerId,
          });
        }
      }

      return grouped;
    },
    enabled: messageIds.length > 0,
  });
}

// ── Send message ───────────────────────────────────────

export function useSendArenaMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      channelId: string;
      leagueId: string;
      managerId: string;
      content: string;
      messageType?: string;
      metadata?: any;
      courseId?: string | null;
    }) => {
      const insertData: any = {
        channel_id: params.channelId,
        league_id: params.leagueId,
        author_manager_id: params.managerId,
        content: params.content,
        message_type: params.messageType || "user",
        metadata: params.metadata || {},
      };

      // Add course_id for live-courses messages
      if (params.courseId) {
        insertData.course_id = params.courseId;
      }

      const { data, error } = await supabase
        .from("arena_messages")
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["arena-messages", variables.channelId, variables.leagueId],
      });
    },
  });
}

// ── Broadcast message to ALL leagues (super-admin only) ───

export function useBroadcastLiveMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      content: string;
      courseId: string;
      managerId: string;
      metadata?: any;
    }) => {
      const { data, error } = await supabase.rpc("arena_broadcast_live_message", {
        p_content: params.content,
        p_course_id: params.courseId,
        p_manager_id: params.managerId,
        p_metadata: params.metadata || {},
      });

      if (error) throw error;
      return data as { success: boolean; leagues_count: number };
    },
    onSuccess: () => {
      // Invalidate all arena message queries to refresh
      queryClient.invalidateQueries({ queryKey: ["arena-messages"] });
    },
  });
}

// ── Toggle reaction ────────────────────────────────────

export function useToggleReaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      messageId: string;
      managerId: string;
      emoji: string;
    }) => {
      const { data: existing } = await supabase
        .from("arena_reactions")
        .select("id")
        .eq("message_id", params.messageId)
        .eq("manager_id", params.managerId)
        .eq("emoji", params.emoji)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("arena_reactions")
          .delete()
          .eq("id", existing.id);
        if (error) throw error;
        return { action: "removed" as const };
      } else {
        const { error } = await supabase.from("arena_reactions").insert({
          message_id: params.messageId,
          manager_id: params.managerId,
          emoji: params.emoji,
        });
        if (error) throw error;
        return { action: "added" as const };
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["arena-reactions"] });
    },
  });
}

// ── League managers (for @mentions) ────────────────────

export function useLeagueManagers(leagueId: string) {
  return useQuery({
    queryKey: ["arena-league-managers", leagueId],
    queryFn: async () => {
      const { data: members, error: membersError } = await supabase
        .from("league_members")
        .select("user_id")
        .eq("league_id", leagueId);

      if (membersError) throw membersError;
      if (!members?.length) return [];

      const { data: managers, error: managersError } = await supabase
        .from("managers")
        .select("id, nom, avatar_url")
        .in(
          "user_id",
          members.map((m) => m.user_id)
        );

      if (managersError) throw managersError;
      return (managers || []) as LeagueManager[];
    },
    enabled: !!leagueId,
    staleTime: 1000 * 60 * 5,
  });
}

// ── Rider owners (for rider mention decorations) ──────

export function useLeagueRosterOwners(leagueId: string) {
  return useQuery({
    queryKey: ["arena-league-roster-owners", leagueId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rosters")
        .select("coureur_id, managers!rosters_manager_id_fkey(nom)")
        .eq("league_id", leagueId);

      if (error) throw error;

      const ownersMap: Record<string, string> = {};
      for (const r of data || []) {
        if (r.coureur_id && (r.managers as any)?.nom) {
          ownersMap[r.coureur_id] = (r.managers as any).nom;
        }
      }
      return ownersMap;
    },
    enabled: !!leagueId,
    staleTime: 1000 * 60 * 5,
  });
}

// ── Realtime subscriptions ─────────────────────────────

export function useArenaRealtime(
  channelId: string | null,
  leagueId: string
) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!channelId || !leagueId) return;

    const channel = supabase
      .channel(`arena-rt-${channelId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "arena_messages",
          filter: `channel_id=eq.${channelId}`,
        },
        () => {
          queryClient.invalidateQueries({
            queryKey: ["arena-messages", channelId, leagueId],
          });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "arena_reactions",
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["arena-reactions"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [channelId, leagueId, queryClient]);
}
