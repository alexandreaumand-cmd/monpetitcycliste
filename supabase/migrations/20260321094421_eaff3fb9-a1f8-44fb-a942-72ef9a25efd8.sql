ALTER TABLE public.leagues DROP CONSTRAINT valid_game_mode;
ALTER TABLE public.leagues ADD CONSTRAINT valid_game_mode 
  CHECK (game_mode = ANY (ARRAY[
    'full_season', 'short_gt', 'short_wt', 'short_classics',
    'five_phases', 'per_course'
  ]));