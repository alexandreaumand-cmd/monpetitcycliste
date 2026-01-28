import { useEffect, useMemo, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentManager } from './useCurrentManager';

export interface Notification {
  id: string;
  type: 'startlist_validated' | 'results_added' | 'auction_opened' | 'auction_closed';
  title: string;
  message: string;
  metadata: {
    race_id?: string;
    startlist_id?: string;
    course_id?: string;
    type_classement?: string;
    etape_numero?: number;
    auction_id?: string;
    round_number?: number;
    phase_id?: string;
    league_id?: string;
  };
  created_at: string;
  is_read: boolean;
}

export const useNotifications = () => {
  const { data: manager } = useCurrentManager();
  const queryClient = useQueryClient();

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ["notifications", manager?.id],
    queryFn: async () => {
      if (!manager?.id) return [];
      
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('manager_id', manager.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Error fetching notifications:', error);
        return [];
      }
      return (data || []) as Notification[];
    },
    enabled: !!manager?.id,
    staleTime: 30000, // 30 seconds
  });

  const unreadCount = useMemo(() => 
    notifications.filter(n => !n.is_read).length, 
    [notifications]
  );

  // Subscribe to realtime updates filtered by manager_id
  useEffect(() => {
    if (!manager?.id) return;

    const channel = supabase
      .channel(`notifications-${manager.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `manager_id=eq.${manager.id}`
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["notifications", manager.id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [manager?.id, queryClient]);

  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId);

      if (!error && manager?.id) {
        // Optimistic update
        queryClient.setQueryData<Notification[]>(
          ["notifications", manager.id],
          (old) => old?.map(n => n.id === notificationId ? { ...n, is_read: true } : n) || []
        );
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  }, [manager?.id, queryClient]);

  const markAllAsRead = useCallback(async () => {
    if (!manager?.id) return;
    
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('manager_id', manager.id)
        .eq('is_read', false);

      if (!error) {
        // Optimistic update
        queryClient.setQueryData<Notification[]>(
          ["notifications", manager.id],
          (old) => old?.map(n => ({ ...n, is_read: true })) || []
        );
      }
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  }, [manager?.id, queryClient]);

  const refetch = useCallback(() => {
    if (manager?.id) {
      queryClient.invalidateQueries({ queryKey: ["notifications", manager.id] });
    }
  }, [manager?.id, queryClient]);

  return {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    markAllAsRead,
    refetch
  };
};
