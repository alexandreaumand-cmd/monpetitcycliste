-- Fix Security Definer Views by setting security_invoker = true
-- This ensures views respect RLS policies of the querying user, not the view creator

-- Enable security_invoker on views that are currently using security definer (default)
ALTER VIEW public.coureurs_disponibilite SET (security_invoker = on);
ALTER VIEW public.courses_for_points_norm SET (security_invoker = on);
ALTER VIEW public.managers_rosters_status SET (security_invoker = on);
ALTER VIEW public.scoring_rules_norm SET (security_invoker = on);
ALTER VIEW public.v_coureurs_saisons_admin SET (security_invoker = on);
ALTER VIEW public.v_course_points_theoriques SET (security_invoker = on);
ALTER VIEW public.v_home_recent_results SET (security_invoker = on);
ALTER VIEW public.v_manager_bonus_aggregated SET (security_invoker = on);
ALTER VIEW public.v_manager_breakdown SET (security_invoker = on);
ALTER VIEW public.v_manager_standings_by_phase_v2 SET (security_invoker = on);
ALTER VIEW public.v_manager_standings_by_season_v2 SET (security_invoker = on);
ALTER VIEW public.v_manager_standings_total SET (security_invoker = on);
ALTER VIEW public.v_race_results_editable SET (security_invoker = on);
ALTER VIEW public.v_top_riders_by_phase SET (security_invoker = on);
ALTER VIEW public.v_top_riders_by_season SET (security_invoker = on);
ALTER VIEW public.v_top_riders_global SET (security_invoker = on);