-- Correction de l'entrée ZANA Filippo mal matchée avec Ganna
UPDATE startlist_entries
SET coureur_id = 'filippo_zana',
    confidence = 1.0,
    status = 'confirmed'
WHERE id = '0e2f4796-8ae9-4014-be91-69121918a08f';

-- Ajout d'un alias pour prévenir les futures confusions
INSERT INTO name_aliases (coureur_id, alias_text, source_team)
VALUES ('filippo_zana', 'ZANA FILIPPO', 'JAY')
ON CONFLICT (alias_text, coureur_id) DO NOTHING;