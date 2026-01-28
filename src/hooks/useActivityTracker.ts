import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentManager } from '@/hooks/useCurrentManager';

// Generate or retrieve session ID
const getSessionId = (): string => {
  let sessionId = sessionStorage.getItem('activity_session_id');
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    sessionStorage.setItem('activity_session_id', sessionId);
  }
  return sessionId;
};

export const useActivityTracker = () => {
  const location = useLocation();
  const { data: manager } = useCurrentManager();
  const lastLogId = useRef<string | null>(null);
  const lastLogTime = useRef<number>(Date.now());
  const sessionId = useRef<string>(getSessionId());

  useEffect(() => {
    if (!manager?.user_id) return;

    const trackPageView = async () => {
      try {

        // Update duration of previous page
        if (lastLogId.current) {
          const durationSeconds = Math.floor((Date.now() - lastLogTime.current) / 1000);
          if (durationSeconds > 0 && durationSeconds < 3600) { // Max 1 hour per page
            await supabase
              .from('user_activity_logs')
              .update({ duration_seconds: durationSeconds })
              .eq('id', lastLogId.current);
          }
        }

        // Insert new page view
        const { data, error } = await supabase
          .from('user_activity_logs')
          .insert({
            user_id: manager.user_id,
            page_path: location.pathname,
            page_title: document.title,
            session_id: sessionId.current,
          })
          .select('id')
          .single();

        if (error) {
          console.error('[ActivityTracker] Insert error:', error.message);
        } else {
          lastLogId.current = data?.id || null;
          lastLogTime.current = Date.now();
        }
      } catch (err) {
        console.error('[ActivityTracker] Error:', err);
      }
    };

    // Small delay to ensure page is fully loaded
    const timeoutId = setTimeout(trackPageView, 100);

    // Update duration when user leaves page
    const handleBeforeUnload = async () => {
      if (lastLogId.current) {
        const durationSeconds = Math.floor((Date.now() - lastLogTime.current) / 1000);
        if (durationSeconds > 0 && durationSeconds < 3600) {
          // Use sendBeacon for reliability on page unload
          const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/user_activity_logs?id=eq.${lastLogId.current}`;
          const body = JSON.stringify({ duration_seconds: durationSeconds });
          navigator.sendBeacon(url, body);
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [location.pathname, manager?.user_id]);
};
