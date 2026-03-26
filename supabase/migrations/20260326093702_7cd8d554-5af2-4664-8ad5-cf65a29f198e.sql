ALTER TABLE public.manager_bonus_points
ADD CONSTRAINT fk_manager_bonus_points_league
FOREIGN KEY (league_id) REFERENCES public.leagues(id);