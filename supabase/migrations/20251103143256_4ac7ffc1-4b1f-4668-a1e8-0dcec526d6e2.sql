-- Synchronize points_ledger with race_results
-- Insert all missing entries where race_results has finished riders with positions
-- This fixes incomplete Top 10 data in the RecentResultsWidget

INSERT INTO points_ledger (
  phase_id,
  course_id,
  coureur_id,
  type_classement,
  etape_numero,
  points
)
SELECT 
  c.phase_id,
  rr.course_id,
  rr.coureur_id,
  rr.type_classement,
  rr.etape_numero,
  COALESCE(rr.points, 0) as points
FROM race_results rr
JOIN courses c ON c.id = rr.course_id
LEFT JOIN points_ledger pl ON 
  pl.course_id = rr.course_id 
  AND pl.coureur_id = rr.coureur_id
  AND pl.type_classement = rr.type_classement
  AND COALESCE(pl.etape_numero, -1) = COALESCE(rr.etape_numero, -1)
WHERE pl.id IS NULL  -- Only insert missing entries
  AND rr.statut = 'finished'
  AND rr.position IS NOT NULL
  AND c.phase_id IS NOT NULL;