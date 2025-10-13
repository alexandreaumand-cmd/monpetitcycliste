-- Drop and recreate v_manager_breakdown view with phase_id column
DROP VIEW IF EXISTS v_manager_breakdown;

CREATE VIEW v_manager_breakdown AS
SELECT 
  pl.manager_id,
  m.nom AS manager_nom,
  pl.phase_id,
  co.id AS course_id,
  co.nom AS course_nom,
  co.date_debut,
  co.date_fin,
  pl.type_classement,
  COALESCE(pl.etape_numero, 0) AS etape_numero,
  cu.id AS coureur_id,
  cu.nom AS coureur_nom,
  pl.points
FROM points_ledger pl
JOIN managers m ON m.id = pl.manager_id
JOIN courses co ON co.id = pl.course_id
JOIN coureurs cu ON cu.id = pl.coureur_id
ORDER BY pl.manager_id, co.date_debut DESC, pl.type_classement, pl.etape_numero, pl.points DESC;