CREATE OR REPLACE FUNCTION public.get_riders_data_for_season(p_saison_id uuid)
 RETURNS TABLE(coureur_id text, coureur_nom text, equipe_id uuid, equipe_nom text, equipe_categorie text, prix_initial numeric, saison_id uuid, total_points bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Require authenticated access (page is behind login)
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  RETURN QUERY
  WITH phase_ids AS (
    SELECT p.id
    FROM public.phases p
    WHERE p.saison_id = p_saison_id
  ),
  pts AS (
    SELECT pl.coureur_id,
           SUM(pl.points)::bigint AS total_points
    FROM public.points_ledger pl
    WHERE pl.phase_id IN (SELECT pi.id FROM phase_ids pi)
    GROUP BY pl.coureur_id
  )
  SELECT
    cs.coureur_id,
    c.nom AS coureur_nom,
    cs.equipe_id,
    COALESCE(es.nom_affiche, '') AS equipe_nom,
    es.categorie AS equipe_categorie,
    COALESCE(cs.prix_initial, c.prix_initial)::numeric AS prix_initial,
    cs.saison_id,
    COALESCE(pts.total_points, 0)::bigint AS total_points
  FROM public.coureurs_saisons cs
  JOIN public.coureurs c ON c.id = cs.coureur_id
  LEFT JOIN public.equipes_saisons es
    ON es.equipe_id = cs.equipe_id
   AND es.saison_id = cs.saison_id
  LEFT JOIN pts ON pts.coureur_id = cs.coureur_id
  WHERE cs.saison_id = p_saison_id
    AND cs.actif = true
  ORDER BY COALESCE(pts.total_points, 0) DESC, c.nom ASC;
END;
$function$;