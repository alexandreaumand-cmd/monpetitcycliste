
ALTER TABLE public.bonus_points ADD COLUMN course_id text;

UPDATE public.bonus_points
SET course_id = split_part(commentaire, ' - ', 2)
WHERE bonus_type = 'coureur_bonuse'
  AND commentaire LIKE 'Bonus coureur automatique%'
  AND split_part(commentaire, ' - ', 2) IN (SELECT id FROM courses);
