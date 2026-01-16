-- Add taken_by_manager_id to coureurs_disponibilite view
DROP VIEW IF EXISTS public.coureurs_disponibilite CASCADE;

CREATE VIEW public.coureurs_disponibilite AS
SELECT 
  c.id,
  c.nom,
  c.uci_id,
  es.nom_affiche AS equipe,
  cs.prix_initial,
  cs.saison_id,
  p.id AS phase_id,
  p.statut AS phase_statut,
  r.league_id,
  CASE 
    WHEN r.coureur_id IS NOT NULL THEN true
    ELSE false
  END AS is_taken,
  m.id AS taken_by_manager_id,
  m.nom AS taken_by_manager_nom
FROM public.coureurs c
JOIN public.coureurs_saisons cs ON c.id = cs.coureur_id
LEFT JOIN public.equipes_saisons es ON cs.equipe_id = es.equipe_id AND cs.saison_id = es.saison_id
CROSS JOIN public.phases p
LEFT JOIN public.rosters r ON c.id = r.coureur_id AND p.id = r.phase_id
LEFT JOIN public.managers m ON r.manager_id = m.id
WHERE cs.saison_id = p.saison_id;