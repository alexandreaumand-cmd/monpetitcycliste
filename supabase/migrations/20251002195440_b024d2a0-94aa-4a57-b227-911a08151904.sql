-- Recréer la vue coureurs_disponibilite avec la variante A recommandée
DROP VIEW IF EXISTS coureurs_disponibilite CASCADE;

CREATE OR REPLACE VIEW coureurs_disponibilite AS
SELECT
  c.id                         AS coureur_id,
  c.nom                        AS coureur_nom,
  c.equipe                     AS coureur_equipe,
  c.prix_initial               AS prix_initial,
  lower(normalize_text(c.nom)) AS search_text,
  p.id                         AS phase_id,
  -- Est-ce que ce coureur est pris dans cette phase ?
  CASE WHEN EXISTS (
    SELECT 1 FROM rosters r
    WHERE r.phase_id = p.id
      AND r.coureur_id = c.id
  ) THEN true ELSE false END   AS is_taken,
  -- Qui l'a pris dans cette phase ?
  (
    SELECT m.nom
    FROM rosters r
    JOIN managers m ON m.id = r.manager_id
    WHERE r.phase_id = p.id
      AND r.coureur_id = c.id
    LIMIT 1
  )                            AS taken_by_manager_nom
FROM coureurs c
CROSS JOIN phases p
-- PAS de WHERE sur rosters ici, on veut TOUS les coureurs
ORDER BY c.nom ASC;

-- RLS
ALTER VIEW coureurs_disponibilite SET (security_invoker = on);