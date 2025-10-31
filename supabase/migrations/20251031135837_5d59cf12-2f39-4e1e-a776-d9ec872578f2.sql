-- Fix v_manager_breakdown to filter by league's configured season
-- This prevents leagues from seeing races from other seasons

DROP VIEW IF EXISTS v_manager_breakdown;

CREATE VIEW v_manager_breakdown AS
SELECT
  r.manager_id,
  r.league_id,
  pl.phase_id,
  pl.course_id,
  pl.coureur_id,
  pl.type_classement,
  pl.etape_numero,
  pl.points,
  m.nom AS manager_nom,
  c.nom AS course_nom,
  c.date_debut,
  c.date_fin,
  co.nom AS coureur_nom
FROM points_ledger pl
JOIN rosters r ON r.coureur_id = pl.coureur_id AND r.phase_id = pl.phase_id
JOIN managers m ON m.id = r.manager_id
JOIN courses c ON c.id = pl.course_id
JOIN coureurs co ON co.id = pl.coureur_id
JOIN phases p ON p.id = pl.phase_id
JOIN league_scopes ls ON ls.league_id = r.league_id AND ls.season_id = p.saison_id;