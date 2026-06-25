
DROP FUNCTION IF EXISTS public.get_global_rosters(uuid, uuid[], uuid[], text[], text, text, int, int);

CREATE OR REPLACE FUNCTION public.get_global_rosters(
  _saison_id uuid DEFAULT NULL,
  _league_ids uuid[] DEFAULT NULL,
  _phase_ids uuid[] DEFAULT NULL,
  _game_modes text[] DEFAULT NULL,
  _coureur_search text DEFAULT NULL,
  _manager_search text DEFAULT NULL,
  _limit int DEFAULT 100,
  _offset int DEFAULT 0
)
RETURNS TABLE (
  roster_id uuid,
  coureur_id text,
  coureur_nom text,
  equipe_nom text,
  cote numeric,
  manager_id uuid,
  manager_nom text,
  league_id uuid,
  league_name text,
  game_mode text,
  phase_id uuid,
  phase_index int,
  saison_id uuid,
  saison_annee int,
  prix_signature numeric,
  round_achat int,
  total_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH filtered AS (
    SELECT
      r.id AS roster_id,
      r.coureur_id,
      c.nom AS coureur_nom,
      COALESCE(es.nom_affiche, c.equipe) AS equipe_nom,
      cs.prix_initial AS cote,
      r.manager_id,
      m.nom AS manager_nom,
      r.league_id,
      l.name AS league_name,
      l.game_mode,
      r.phase_id,
      p.index_dans_saison AS phase_index,
      p.saison_id,
      s.annee AS saison_annee,
      r.prix_signature,
      (
        SELECT b.round_number
        FROM public.bids b
        JOIN public.auctions a ON a.id = b.auction_id
        WHERE b.statut = 'won'
          AND b.manager_id = r.manager_id
          AND b.coureur_id = r.coureur_id
          AND b.league_id = r.league_id
          AND a.phase_id = r.phase_id
        ORDER BY b.round_number ASC
        LIMIT 1
      ) AS round_achat
    FROM public.rosters r
    JOIN public.managers m ON m.id = r.manager_id
    JOIN public.leagues l ON l.id = r.league_id
    JOIN public.phases p ON p.id = r.phase_id
    JOIN public.saisons s ON s.id = p.saison_id
    JOIN public.coureurs c ON c.id = r.coureur_id
    LEFT JOIN public.coureurs_saisons cs ON cs.coureur_id = r.coureur_id AND cs.saison_id = p.saison_id
    LEFT JOIN public.equipes_saisons es ON es.id = cs.equipe_id
    WHERE public.has_role(auth.uid(), 'superadmin')
      AND (_saison_id IS NULL OR p.saison_id = _saison_id)
      AND (_league_ids IS NULL OR r.league_id = ANY(_league_ids))
      AND (_phase_ids IS NULL OR r.phase_id = ANY(_phase_ids))
      AND (_game_modes IS NULL OR l.game_mode = ANY(_game_modes))
      AND (_coureur_search IS NULL OR c.nom ILIKE '%' || _coureur_search || '%')
      AND (_manager_search IS NULL OR m.nom ILIKE '%' || _manager_search || '%')
  ),
  counted AS (
    SELECT COUNT(*) AS n FROM filtered
  )
  SELECT f.*, c.n AS total_count
  FROM filtered f
  CROSS JOIN counted c
  ORDER BY f.coureur_nom ASC, f.saison_annee DESC, f.league_name ASC, f.phase_index ASC
  LIMIT _limit OFFSET _offset;
$$;

REVOKE ALL ON FUNCTION public.get_global_rosters(uuid, uuid[], uuid[], text[], text, text, int, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_global_rosters(uuid, uuid[], uuid[], text[], text, text, int, int) TO authenticated;
