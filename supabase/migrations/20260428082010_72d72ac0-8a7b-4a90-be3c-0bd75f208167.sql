CREATE OR REPLACE FUNCTION public.auto_archive_completed_leagues()
RETURNS TABLE(archived_league_id uuid, archived_league_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
BEGIN
  RETURN QUERY
  WITH eligible AS (
    SELECT l.id, l.name
    FROM public.leagues l
    JOIN public.league_scopes ls ON ls.league_id = l.id
    WHERE l.status = 'active'
      AND l.name NOT ILIKE '%legacy%'
      AND (
        (
          l.game_mode = 'per_course'
          AND ls.selected_course_ids IS NOT NULL
          AND array_length(ls.selected_course_ids, 1) > 0
          AND NOT EXISTS (
            SELECT 1
            FROM public.courses c
            WHERE c.id = ANY(ls.selected_course_ids)
              AND (c.date_fin IS NULL OR c.date_fin >= CURRENT_DATE)
          )
        )
        OR
        (
          l.game_mode IN ('five_phases', 'full_season')
          AND ls.phases IS NOT NULL
          AND array_length(ls.phases, 1) > 0
          AND NOT EXISTS (
            SELECT 1
            FROM public.phases p
            WHERE p.id = ANY(ls.phases)
              AND p.statut <> 'completed'
          )
        )
      )
  ),
  updated AS (
    UPDATE public.leagues l
    SET status = 'completed',
        archived_at = now()
    FROM eligible e
    WHERE l.id = e.id
    RETURNING l.id, l.name
  )
  SELECT u.id, u.name FROM updated u;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'auto_archive_completed_leagues: archived % league(s)', v_count;
END;
$$;

DO $$
BEGIN
  PERFORM cron.unschedule(jobid)
  FROM cron.job
  WHERE jobname = 'auto-archive-completed-leagues';
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

SELECT cron.schedule(
  'auto-archive-completed-leagues',
  '30 3 * * *',
  $$ SELECT public.auto_archive_completed_leagues(); $$
);

SELECT * FROM public.auto_archive_completed_leagues();