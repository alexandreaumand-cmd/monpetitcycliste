-- Create user activity logs table for tracking page views
CREATE TABLE public.user_activity_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  page_path TEXT NOT NULL,
  page_title TEXT,
  session_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  duration_seconds INTEGER DEFAULT 0
);

-- Create indexes for efficient querying
CREATE INDEX idx_user_activity_logs_user_id ON public.user_activity_logs(user_id);
CREATE INDEX idx_user_activity_logs_created_at ON public.user_activity_logs(created_at DESC);
CREATE INDEX idx_user_activity_logs_session_id ON public.user_activity_logs(session_id);

-- Enable RLS
ALTER TABLE public.user_activity_logs ENABLE ROW LEVEL SECURITY;

-- Users can insert their own activity logs
CREATE POLICY "Users can insert their own activity logs"
ON public.user_activity_logs
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Superadmins can view all activity logs
CREATE POLICY "Superadmins can view all activity logs"
ON public.user_activity_logs
FOR SELECT
USING (is_superadmin());

-- Users can view their own activity logs
CREATE POLICY "Users can view their own activity logs"
ON public.user_activity_logs
FOR SELECT
USING (auth.uid() = user_id);

-- Users can update their own logs (for duration tracking)
CREATE POLICY "Users can update their own activity logs"
ON public.user_activity_logs
FOR UPDATE
USING (auth.uid() = user_id);

-- Create a function to get user activity stats
CREATE OR REPLACE FUNCTION public.get_user_activity_stats(target_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total_page_views', COUNT(*),
    'total_sessions', COUNT(DISTINCT session_id),
    'pages_today', COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE),
    'pages_last_7_days', COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'),
    'pages_last_30_days', COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'),
    'sessions_today', COUNT(DISTINCT session_id) FILTER (WHERE created_at >= CURRENT_DATE),
    'sessions_last_7_days', COUNT(DISTINCT session_id) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'),
    'last_page_path', (SELECT page_path FROM public.user_activity_logs WHERE user_id = target_user_id ORDER BY created_at DESC LIMIT 1),
    'last_activity_at', (SELECT created_at FROM public.user_activity_logs WHERE user_id = target_user_id ORDER BY created_at DESC LIMIT 1),
    'avg_session_duration_seconds', (
      SELECT COALESCE(AVG(session_duration), 0)
      FROM (
        SELECT SUM(duration_seconds) as session_duration
        FROM public.user_activity_logs
        WHERE user_id = target_user_id
        GROUP BY session_id
      ) sessions
    )
  ) INTO result
  FROM public.user_activity_logs
  WHERE user_id = target_user_id;
  
  RETURN result;
END;
$$;