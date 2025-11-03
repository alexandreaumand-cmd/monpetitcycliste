-- Ajouter une colonne pour la suppression logique
ALTER TABLE public.coureurs_saisons 
ADD COLUMN IF NOT EXISTS actif BOOLEAN NOT NULL DEFAULT true;

-- Index pour améliorer les performances des filtres
CREATE INDEX IF NOT EXISTS idx_coureurs_saisons_actif ON public.coureurs_saisons(actif);

-- Commentaire pour documentation
COMMENT ON COLUMN public.coureurs_saisons.actif IS 'Indique si le coureur est actif pour cette saison (soft delete)';

-- Supprimer et recréer la vue pour inclure la colonne actif
DROP VIEW IF EXISTS v_coureurs_saisons_admin;

CREATE VIEW v_coureurs_saisons_admin AS
SELECT 
  cs.id,
  cs.saison_id,
  cs.equipe_id,
  cs.prix_initial,
  cs.actif,
  cs.created_at,
  cs.updated_at,
  s.annee AS saison_annee,
  c.id AS coureur_id,
  c.nom AS coureur_nom,
  c.uci_id,
  e.nom_complet AS equipe_nom,
  e.code_court AS equipe_code
FROM coureurs_saisons cs
JOIN coureurs c ON cs.coureur_id = c.id
JOIN saisons s ON cs.saison_id = s.id
LEFT JOIN equipes e ON cs.equipe_id = e.id;