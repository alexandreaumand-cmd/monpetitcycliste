ALTER TABLE public.manager_bonus_points
  DROP CONSTRAINT IF EXISTS manager_bonus_points_phase_id_manager_id_key;

ALTER TABLE public.manager_bonus_points
  ADD CONSTRAINT manager_bonus_points_phase_manager_league_key
  UNIQUE (phase_id, manager_id, league_id);