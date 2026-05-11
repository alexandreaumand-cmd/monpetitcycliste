## Diagnostic

J'ai trouvé la cause exacte dans les logs de la fonction `compute-bonus-scoreurs` :

```
ERROR Error inserting bonus for manager d86b7204... (Manou):
duplicate key value violates unique constraint
"manager_bonus_points_phase_id_manager_id_key"
Key (phase_id, manager_id) already exists.
```

### Ce qui se passe

1. Manou a bien gagné le bonus Scoreurs dans **Early Adopters** (25 coureurs scoreurs hors TTT, le maximum de la ligue — confirmé en base).
2. Manou avait déjà reçu le bonus Scoreurs pour la Phase 2 dans la ligue **MPC 2026**.
3. La contrainte unique sur `manager_bonus_points` est posée sur `(phase_id, manager_id)` **sans inclure `league_id`**.
4. Conséquence : un même manager ne peut avoir qu'**une seule** ligne de bonus par phase, toutes ligues confondues. L'insertion pour Early Adopters échoue donc en silence.

Le code de la fonction, lui, vérifie l'existence avec le triplet `(phase_id, manager_id, league_id)` — il pense pouvoir insérer, mais la contrainte BDD le refuse. Même problème potentiel pour tous les managers présents dans plusieurs ligues d'une même saison.

## Plan de correction

### 1. Migration BDD : corriger la contrainte unique

```sql
ALTER TABLE public.manager_bonus_points
  DROP CONSTRAINT manager_bonus_points_phase_id_manager_id_key;

ALTER TABLE public.manager_bonus_points
  ADD CONSTRAINT manager_bonus_points_phase_manager_league_key
  UNIQUE (phase_id, manager_id, league_id);
```

À vérifier avant migration : s'assurer qu'aucune autre partie du code ne s'appuie sur l'unicité `(phase_id, manager_id)` seule (ex : `onConflict` dans des `upsert`). J'inspecterai `admin-save-bonus-points` et les autres fonctions touchant à `manager_bonus_points` avant d'écrire la migration définitive.

### 2. Re-lancer le calcul du bonus Scoreurs pour la Phase 2

Une fois la contrainte corrigée, relancer "Calculer le bonus Scoreurs" depuis l'UI pour la Phase 2 attribuera bien les 200 pts à Manou dans Early Adopters (et corrigera tout autre cas similaire silencieusement raté).

### 3. (Optionnel mais recommandé) Améliorer la robustesse de la fonction

Faire remonter une erreur explicite côté UI si une insertion échoue, plutôt que de logger silencieusement et continuer — ça nous éviterait de redécouvrir ce genre de souci par hasard.

## Détails techniques

- Table concernée : `public.manager_bonus_points`
- Contrainte fautive : `manager_bonus_points_phase_id_manager_id_key`
- Fonction edge : `supabase/functions/compute-bonus-scoreurs/index.ts` (lignes 197–204 pour le check, 232–245 pour l'insert)
- Phase 2 id : `8b939cb8-7079-4938-ba00-920603813092`
- League Early Adopters id : `85d46f9b-62b4-48d6-b9e7-3ca6fc5a0062`
- Manou (manager_id) : `d86b7204-f19f-4fa3-8321-cc20ef17af3e`
