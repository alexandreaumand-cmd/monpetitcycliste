-- Ajouter une contrainte unique sur name_aliases pour permettre l'UPSERT
ALTER TABLE name_aliases 
ADD CONSTRAINT name_aliases_alias_text_coureur_id_key 
UNIQUE (alias_text, coureur_id);

-- Créer l'alias pour Tom PIDCOCK
INSERT INTO name_aliases (alias_text, coureur_id, source_team)
VALUES ('PIDCOCK Thomas', 'tom_pidcock', 'Q36')
ON CONFLICT (alias_text, coureur_id) DO NOTHING;