-- Ajout de la colonne trigramme dans equipes_saisons
ALTER TABLE equipes_saisons 
ADD COLUMN IF NOT EXISTS trigramme TEXT;

-- Créer un index pour améliorer les performances de recherche
CREATE INDEX IF NOT EXISTS idx_equipes_saisons_trigramme 
ON equipes_saisons(UPPER(trigramme));

-- Commentaire pour documentation
COMMENT ON COLUMN equipes_saisons.trigramme IS 
'Code trigramme de l''équipe pour cette saison (ex: UAD, TJV, TUK). Utilisé pour le matching avec les startlists.';

-- Pré-remplir les trigrammes avec le code_court de l'équipe UCI pour les données existantes
UPDATE equipes_saisons es
SET trigramme = e.code_court
FROM equipes e
WHERE es.equipe_id = e.id
  AND es.trigramme IS NULL;