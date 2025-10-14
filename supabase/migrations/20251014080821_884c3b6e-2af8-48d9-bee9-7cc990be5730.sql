-- Phase 1: Créer la vue coureurs_disponibilite_enrichie
CREATE OR REPLACE VIEW coureurs_disponibilite_enrichie AS
SELECT 
  c.id,
  c.nom,
  c.uci_id,
  cs.equipe,
  cs.prix_initial,
  cs.saison_id,
  p.id as phase_id,
  p.statut as phase_statut,
  EXISTS(
    SELECT 1 FROM rosters r 
    WHERE r.coureur_id = c.id 
    AND r.phase_id = p.id
  ) as is_taken,
  (
    SELECT m.nom FROM rosters r
    JOIN managers m ON m.id = r.manager_id
    WHERE r.coureur_id = c.id 
    AND r.phase_id = p.id
    LIMIT 1
  ) as taken_by_manager_nom
FROM coureurs c
JOIN coureurs_saisons cs ON cs.coureur_id = c.id
JOIN phases p ON p.saison_id = cs.saison_id
WHERE p.statut = 'active';

-- Phase 2: Migrer les données existantes vers coureurs_saisons pour la saison 2026
INSERT INTO coureurs_saisons (coureur_id, saison_id, equipe, prix_initial)
SELECT 
  id as coureur_id,
  'dcbc02b7-3b3e-471d-9471-efa70743f808' as saison_id,
  equipe,
  prix_initial
FROM coureurs
WHERE equipe IS NOT NULL OR prix_initial IS NOT NULL
ON CONFLICT (coureur_id, saison_id) DO UPDATE SET
  equipe = EXCLUDED.equipe,
  prix_initial = EXCLUDED.prix_initial;

-- Phase 3: Recréer les vues dépendantes pour utiliser coureurs_saisons au lieu de coureurs
-- Note: On garde temporairement equipe et prix_initial dans coureurs pour compatibilité
-- On les supprimera dans une prochaine migration après avoir adapté tout le code

-- Recréer coureurs_disponibilite pour utiliser coureurs_saisons
DROP VIEW IF EXISTS coureurs_disponibilite CASCADE;
CREATE OR REPLACE VIEW coureurs_disponibilite AS
SELECT 
  p.id as phase_id,
  c.id as coureur_id,
  c.nom as coureur_nom,
  cs.equipe as coureur_equipe,
  cs.prix_initial,
  lower(trim(regexp_replace(unaccent(COALESCE(c.nom, '')), '\s+', ' ', 'g'))) || ' ' || 
  lower(trim(regexp_replace(unaccent(COALESCE(cs.equipe, '')), '\s+', ' ', 'g'))) as search_text,
  EXISTS(
    SELECT 1 FROM rosters r 
    WHERE r.coureur_id = c.id 
    AND r.phase_id = p.id
  ) as is_taken,
  (
    SELECT m.nom FROM rosters r
    JOIN managers m ON m.id = r.manager_id
    WHERE r.coureur_id = c.id 
    AND r.phase_id = p.id
    LIMIT 1
  ) as taken_by_manager_nom
FROM coureurs c
JOIN coureurs_saisons cs ON cs.coureur_id = c.id
CROSS JOIN phases p
WHERE p.saison_id = cs.saison_id;