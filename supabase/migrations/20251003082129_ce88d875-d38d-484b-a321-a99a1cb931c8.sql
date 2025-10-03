-- Create manager_my_team function
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
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $function$
WITH current_phase AS (
  SELECT COALESCE(p_phase_id, (
    SELECT id FROM phases WHERE statut = 'active'::phase_statut ORDER BY date_debut DESC LIMIT 1
  )) AS phase_id
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
  c.equipe,
  r.prix_signature AS prix_achat,
  c.prix_initial AS cote_initiale,
  COALESCE(p.points_total, 0) AS points_total,
  ROUND(COALESCE(p.points_total, 0)::numeric / NULLIF(r.prix_signature, 0), 2) AS ratio_points_par_prix
FROM roster r
JOIN coureurs c ON c.id = r.coureur_id
LEFT JOIN points p ON p.coureur_id = r.coureur_id
ORDER BY points_total DESC NULLS LAST;
$function$;

-- Create manager_coureur_points_detail function
CREATE OR REPLACE FUNCTION public.manager_coureur_points_detail(
  p_coureur_id text,
  p_phase_id uuid DEFAULT NULL
)
RETURNS TABLE(
  course_nom text,
  type_classement text,
  etape_numero integer,
  points integer,
  date_classement date,
  total_points bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_phase_id uuid;
  v_manager_id uuid;
  v_total_points bigint;
BEGIN
  -- Get current phase
  v_phase_id := COALESCE(p_phase_id, (
    SELECT id FROM phases WHERE statut = 'active'::phase_statut ORDER BY date_debut DESC LIMIT 1
  ));
  
  -- Get current manager
  SELECT m.id INTO v_manager_id
  FROM managers m
  WHERE m.user_id = auth.uid()
  LIMIT 1;
  
  -- Get total points
  SELECT COALESCE(SUM(pl.points), 0) INTO v_total_points
  FROM points_ledger pl
  WHERE pl.coureur_id = p_coureur_id
    AND pl.phase_id = v_phase_id
    AND pl.manager_id = v_manager_id;
  
  -- Return history
  RETURN QUERY
  SELECT
    c.nom AS course_nom,
    pl.type_classement::text AS type_classement,
    pl.etape_numero,
    pl.points,
    COALESCE(c.date_fin, CURRENT_DATE) AS date_classement,
    v_total_points AS total_points
  FROM points_ledger pl
  JOIN courses c ON c.id = pl.course_id
  WHERE pl.coureur_id = p_coureur_id
    AND pl.phase_id = v_phase_id
    AND pl.manager_id = v_manager_id
  ORDER BY c.date_fin DESC NULLS LAST, c.nom, pl.type_classement::text;
END;
$function$;