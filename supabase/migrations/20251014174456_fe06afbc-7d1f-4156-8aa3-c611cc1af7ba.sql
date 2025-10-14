-- Phase 1: Modifier les fonctions PostgreSQL pour utiliser coureurs_saisons

-- 1.1: Modifier manager_my_team
CREATE OR REPLACE FUNCTION public.manager_my_team(p_phase_id uuid DEFAULT NULL)
RETURNS TABLE(
  coureur_id text,
  nom text,
  equipe text,
  prix_achat numeric,
  cote_initiale numeric,
  points_total bigint,
  ratio_points_par_prix numeric
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
WITH current_phase AS (
  SELECT 
    COALESCE(p_phase_id, (
      SELECT id FROM phases WHERE statut = 'active'::phase_statut ORDER BY date_debut DESC LIMIT 1
    )) AS phase_id,
    p.saison_id
  FROM phases p
  WHERE p.id = COALESCE(p_phase_id, (
    SELECT id FROM phases WHERE statut = 'active'::phase_statut ORDER BY date_debut DESC LIMIT 1
  ))
),
current_manager AS (
  SELECT m.id AS manager_id
  FROM managers m
  WHERE m.user_id = auth.uid()
  LIMIT 1
),
roster AS (
  SELECT r.coureur_id, r.prix_signature
  FROM rosters r, current_phase cp, current_manager cm
  WHERE r.phase_id = cp.phase_id
    AND r.manager_id = cm.manager_id
),
points AS (
  SELECT 
    pl.coureur_id,
    SUM(pl.points) AS points_total
  FROM points_ledger pl, current_phase cp, current_manager cm
  WHERE pl.phase_id = cp.phase_id
    AND pl.manager_id = cm.manager_id
  GROUP BY pl.coureur_id
)
SELECT
  r.coureur_id,
  c.nom,
  get_rider_team_for_season(c.id, cp.saison_id) AS equipe,
  r.prix_signature AS prix_achat,
  COALESCE(cs.prix_initial, c.prix_initial) AS cote_initiale,
  COALESCE(p.points_total, 0) AS points_total,
  ROUND(COALESCE(p.points_total, 0)::numeric / NULLIF(r.prix_signature, 0), 2) AS ratio_points_par_prix
FROM roster r
JOIN coureurs c ON c.id = r.coureur_id
CROSS JOIN current_phase cp
LEFT JOIN coureurs_saisons cs ON cs.coureur_id = c.id AND cs.saison_id = cp.saison_id
LEFT JOIN points p ON p.coureur_id = r.coureur_id
ORDER BY points_total DESC NULLS LAST;
$$;

-- 1.2: Modifier manager_team_by_id
CREATE OR REPLACE FUNCTION public.manager_team_by_id(p_manager_id uuid, p_phase_id uuid DEFAULT NULL)
RETURNS TABLE(
  coureur_id text,
  nom text,
  equipe text,
  prix_achat numeric,
  cote_initiale numeric,
  points_total bigint,
  ratio_points_par_prix numeric
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
WITH current_phase AS (
  SELECT 
    COALESCE(p_phase_id, (
      SELECT id FROM phases WHERE statut = 'active'::phase_statut ORDER BY date_debut DESC LIMIT 1
    )) AS phase_id,
    p.saison_id
  FROM phases p
  WHERE p.id = COALESCE(p_phase_id, (
    SELECT id FROM phases WHERE statut = 'active'::phase_statut ORDER BY date_debut DESC LIMIT 1
  ))
),
roster AS (
  SELECT r.coureur_id, r.prix_signature
  FROM rosters r, current_phase cp
  WHERE r.phase_id = cp.phase_id
    AND r.manager_id = p_manager_id
),
points AS (
  SELECT 
    pl.coureur_id,
    SUM(pl.points) AS points_total
  FROM points_ledger pl, current_phase cp
  WHERE pl.phase_id = cp.phase_id
    AND pl.manager_id = p_manager_id
  GROUP BY pl.coureur_id
)
SELECT
  r.coureur_id,
  c.nom,
  get_rider_team_for_season(c.id, cp.saison_id) AS equipe,
  r.prix_signature AS prix_achat,
  COALESCE(cs.prix_initial, c.prix_initial) AS cote_initiale,
  COALESCE(p.points_total, 0) AS points_total,
  ROUND(COALESCE(p.points_total, 0)::numeric / NULLIF(r.prix_signature, 0), 2) AS ratio_points_par_prix
FROM roster r
JOIN coureurs c ON c.id = r.coureur_id
CROSS JOIN current_phase cp
LEFT JOIN coureurs_saisons cs ON cs.coureur_id = c.id AND cs.saison_id = cp.saison_id
LEFT JOIN points p ON p.coureur_id = r.coureur_id
ORDER BY points_total DESC NULLS LAST;
$$;

-- 1.3: Modifier validate_bonus_rider_cote
CREATE OR REPLACE FUNCTION public.validate_bonus_rider_cote()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_saison_id uuid;
  v_cote_initiale NUMERIC;
BEGIN
  -- Récupérer la saison_id depuis la phase
  SELECT p.saison_id INTO v_saison_id
  FROM phases p
  WHERE p.id = NEW.phase_id;
  
  IF v_saison_id IS NULL THEN
    RAISE EXCEPTION 'Impossible de déterminer la saison pour la phase %', NEW.phase_id;
  END IF;
  
  -- Récupérer la cote initiale depuis coureurs_saisons
  SELECT prix_initial INTO v_cote_initiale
  FROM coureurs_saisons
  WHERE coureur_id = NEW.coureur_id
    AND saison_id = v_saison_id;
  
  -- Si pas trouvé dans coureurs_saisons, fallback sur coureurs
  IF v_cote_initiale IS NULL THEN
    SELECT prix_initial INTO v_cote_initiale
    FROM coureurs
    WHERE id = NEW.coureur_id;
  END IF;
  
  -- Vérifier que la cote est 10 ou 20
  IF v_cote_initiale IS NULL OR (v_cote_initiale != 10 AND v_cote_initiale != 20) THEN
    RAISE EXCEPTION 'Seuls les coureurs avec une cote initiale de 10 ou 20 peuvent être désignés comme coureur bonus (cote actuelle: %)', v_cote_initiale;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- 1.4: Modifier trigger_calculate_bonus_rider
CREATE OR REPLACE FUNCTION public.trigger_calculate_bonus_rider()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_is_bonus_rider BOOLEAN;
  v_bonus_amount INTEGER;
  v_saison_id uuid;
BEGIN
  -- Ne calculer que si le manager_id est défini et points > 0
  IF NEW.manager_id IS NULL OR NEW.points <= 0 THEN
    RETURN NEW;
  END IF;

  -- Récupérer la saison_id depuis la phase
  SELECT p.saison_id INTO v_saison_id
  FROM phases p
  WHERE p.id = NEW.phase_id;

  -- Vérifier si ce coureur est le bonus rider du manager pour cette phase ET a une cote 10/20
  SELECT EXISTS(
    SELECT 1 
    FROM bonus_rider_selections brs
    LEFT JOIN coureurs_saisons cs ON cs.coureur_id = brs.coureur_id AND cs.saison_id = v_saison_id
    LEFT JOIN coureurs c ON c.id = brs.coureur_id
    WHERE brs.manager_id = NEW.manager_id
      AND brs.phase_id = NEW.phase_id
      AND brs.coureur_id = NEW.coureur_id
      AND COALESCE(cs.prix_initial, c.prix_initial) IN (10, 20)
  ) INTO v_is_bonus_rider;

  -- Si c'est le bonus rider avec la bonne cote, calculer et insérer le bonus (25%)
  IF v_is_bonus_rider THEN
    v_bonus_amount := FLOOR(NEW.points * 0.25);
    
    INSERT INTO bonus_points (
      phase_id,
      coureur_id,
      manager_id,
      target_manager_id,
      bonus_type,
      points,
      commentaire,
      created_by
    ) VALUES (
      NEW.phase_id,
      NEW.coureur_id,
      NEW.manager_id,
      NULL,
      'coureur_bonuse',
      v_bonus_amount,
      'Bonus coureur automatique (25%) - ' || COALESCE(NEW.course_id, 'Course') || ' - ' || NEW.type_classement::text,
      NEW.manager_id
    );
    
    RAISE NOTICE 'Bonus coureur calculé: % pts pour coureur % (course: %)', v_bonus_amount, NEW.coureur_id, NEW.course_id;
  END IF;

  RETURN NEW;
END;
$function$;

-- 1.5: Modifier calculate_retroactive_bonus_after_selection
CREATE OR REPLACE FUNCTION public.calculate_retroactive_bonus_after_selection()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_points_record RECORD;
  v_bonus_amount INTEGER;
  v_saison_id uuid;
  v_cote_initiale NUMERIC;
BEGIN
  -- Récupérer la saison_id depuis la phase
  SELECT p.saison_id INTO v_saison_id
  FROM phases p
  WHERE p.id = NEW.phase_id;

  -- Vérifier que le coureur a une cote éligible (depuis coureurs_saisons)
  SELECT prix_initial INTO v_cote_initiale
  FROM coureurs_saisons
  WHERE coureur_id = NEW.coureur_id
    AND saison_id = v_saison_id;
  
  -- Si pas trouvé dans coureurs_saisons, fallback sur coureurs
  IF v_cote_initiale IS NULL THEN
    SELECT prix_initial INTO v_cote_initiale
    FROM coureurs
    WHERE id = NEW.coureur_id;
  END IF;
  
  IF v_cote_initiale IS NULL OR (v_cote_initiale != 10 AND v_cote_initiale != 20) THEN
    RETURN NEW;
  END IF;

  -- Parcourir tous les points existants du coureur pour ce manager et cette phase
  FOR v_points_record IN
    SELECT 
      pl.phase_id,
      pl.course_id,
      pl.coureur_id,
      pl.type_classement,
      pl.points
    FROM points_ledger pl
    WHERE pl.coureur_id = NEW.coureur_id
      AND pl.manager_id = NEW.manager_id
      AND pl.phase_id = NEW.phase_id
      AND pl.points > 0
  LOOP
    -- Calculer le bonus (25%)
    v_bonus_amount := FLOOR(v_points_record.points * 0.25);
    
    INSERT INTO bonus_points (
      phase_id,
      coureur_id,
      manager_id,
      target_manager_id,
      bonus_type,
      points,
      commentaire,
      created_by
    ) VALUES (
      v_points_record.phase_id,
      v_points_record.coureur_id,
      NEW.manager_id,
      NULL,
      'coureur_bonuse',
      v_bonus_amount,
      'Bonus coureur rétroactif (25%) - ' || COALESCE(v_points_record.course_id, 'Course') || ' - ' || v_points_record.type_classement::text,
      NEW.manager_id
    );
  END LOOP;

  RETURN NEW;
END;
$function$;