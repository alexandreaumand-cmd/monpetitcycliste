CREATE UNIQUE INDEX IF NOT EXISTS bonus_points_unique_rider_bonus_no_manager
ON public.bonus_points (
  phase_id,
  bonus_type,
  coureur_id,
  course_id,
  COALESCE(etape_numero, '-1'::integer),
  COALESCE(type_classement, ''::text)
)
WHERE (coureur_id IS NOT NULL AND manager_id IS NULL AND course_id IS NOT NULL);