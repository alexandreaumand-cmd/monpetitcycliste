-- 1. Ajout de la granularité étape / type de classement
ALTER TABLE public.bonus_points
  ADD COLUMN IF NOT EXISTS etape_numero integer,
  ADD COLUMN IF NOT EXISTS type_classement text;

-- 2. Backfill des bonus existants : rattacher au classement d'origine quand c'est déterminable
UPDATE public.bonus_points bp
SET etape_numero = pl.etape_numero,
    type_classement = pl.type_classement::text
FROM (
  SELECT DISTINCT ON (course_id, coureur_id, phase_id)
         course_id, coureur_id, phase_id, etape_numero, type_classement
  FROM public.points_ledger
  ORDER BY course_id, coureur_id, phase_id, points DESC
) pl
WHERE bp.bonus_type = 'coureur_bonuse'
  AND bp.type_classement IS NULL
  AND bp.course_id = pl.course_id
  AND bp.coureur_id = pl.coureur_id
  AND bp.phase_id = pl.phase_id;

-- 3. Nouvelle unicité incluant étape + type de classement
DROP INDEX IF EXISTS public.bonus_points_unique_rider_bonus;

CREATE UNIQUE INDEX bonus_points_unique_rider_bonus
  ON public.bonus_points (
    phase_id,
    bonus_type,
    coureur_id,
    manager_id,
    league_id,
    course_id,
    COALESCE(etape_numero, -1),
    COALESCE(type_classement, '')
  )
  WHERE coureur_id IS NOT NULL
    AND manager_id IS NOT NULL
    AND course_id IS NOT NULL;

-- 4. Déclencheur : un bonus de 25 % par ligne de points (étape ou classement final)
CREATE OR REPLACE FUNCTION public.trigger_calculate_bonus_rider()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_manager_rec RECORD;
  v_bonus_amount NUMERIC(10,2);
  v_comment TEXT;
  v_label TEXT;
BEGIN
  IF NEW.points IS NULL OR NEW.points <= 0 THEN
    RETURN NEW;
  END IF;

  IF NEW.course_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_bonus_amount := ROUND(NEW.points * 0.25, 2);

  IF NEW.etape_numero IS NOT NULL THEN
    v_label := 'Étape ' || NEW.etape_numero || ' - ' || COALESCE(NEW.type_classement::text, 'Classement');
  ELSE
    v_label := COALESCE(NEW.type_classement::text, 'Classement');
  END IF;

  v_comment := 'Bonus coureur automatique (25%) - ' || NEW.course_id || ' - ' || v_label;

  FOR v_manager_rec IN
    SELECT DISTINCT r.manager_id, r.league_id
    FROM rosters r
    INNER JOIN bonus_rider_selections brs
      ON brs.manager_id = r.manager_id
      AND brs.phase_id = r.phase_id
      AND brs.coureur_id = r.coureur_id
      AND brs.league_id = r.league_id
    WHERE r.coureur_id = NEW.coureur_id
      AND r.phase_id = NEW.phase_id
  LOOP
    INSERT INTO bonus_points (
      phase_id, coureur_id, manager_id, league_id,
      bonus_type, points, commentaire, created_by, course_id,
      etape_numero, type_classement
    ) VALUES (
      NEW.phase_id, NEW.coureur_id, v_manager_rec.manager_id, v_manager_rec.league_id,
      'coureur_bonuse', v_bonus_amount, v_comment, v_manager_rec.manager_id, NEW.course_id,
      NEW.etape_numero, NEW.type_classement::text
    )
    ON CONFLICT (
      phase_id, bonus_type, coureur_id, manager_id, league_id, course_id,
      COALESCE(etape_numero, -1), COALESCE(type_classement, '')
    ) WHERE coureur_id IS NOT NULL AND manager_id IS NOT NULL AND course_id IS NOT NULL
    DO UPDATE SET points = EXCLUDED.points,
                  commentaire = EXCLUDED.commentaire,
                  updated_at = now();
  END LOOP;

  RETURN NEW;
END;
$function$;