-- 1) Fonction d'auto-complétion des ligues per_course
CREATE OR REPLACE FUNCTION public.auto_complete_per_course_leagues()
RETURNS TABLE(league_id uuid, league_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH updated AS (
    UPDATE public.leagues l
    SET status = 'completed',
        archived_at = COALESCE(l.archived_at, now())
    WHERE l.status = 'active'
      AND l.game_mode = 'per_course'
      AND EXISTS (
        SELECT 1
        FROM public.league_scopes ls
        WHERE ls.league_id = l.id
          AND ls.selected_course_ids IS NOT NULL
          AND array_length(ls.selected_course_ids, 1) > 0
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.league_scopes ls
        JOIN public.courses c ON c.id = ANY(ls.selected_course_ids)
        WHERE ls.league_id = l.id
          AND (c.date_fin IS NULL OR c.date_fin >= CURRENT_DATE)
      )
    RETURNING l.id, l.name
  )
  SELECT id, name FROM updated;
END;
$$;

-- 2) Planification quotidienne (03:15 UTC)
DO $$
BEGIN
  -- Désinscrire un éventuel job existant pour idempotence
  PERFORM cron.unschedule('auto-complete-per-course-leagues')
  WHERE EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'auto-complete-per-course-leagues'
  );
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

SELECT cron.schedule(
  'auto-complete-per-course-leagues',
  '15 3 * * *',
  $$SELECT public.auto_complete_per_course_leagues();$$
);

-- 3) Exécution immédiate (backfill) — ferme T1 - Barb+Amstel et toute autre ligue per_course terminée
SELECT public.auto_complete_per_course_leagues();