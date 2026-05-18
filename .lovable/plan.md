## Ajout du pronostic de Matt L

**Contexte trouvé :**
- Course : `fl_che_du_sud` — Flèche du Sud
- Étape : 5 (deadline passée, type `stage_winner`, non-TTT)
- Ligue : `b5b46b5e-7c78-4ad9-a669-b08e8f099800` — MPC 2026
- Manager : `c6a95b05-67b3-4244-8470-fabd09e14f62` — Matt L
- Coureur : `matthew_brennan` — Matthew BRENNAN (vainqueur réel, déjà validé pour les autres pronostics)

**Actions SQL (via insert tool) :**

1. Insérer la ligne dans `arena_pronostics` avec :
   - `is_correct = true`
   - `evaluated_at = now()`
   - `pronostic_type = 'stage_winner'`, `etape_numero = 5`

2. Insérer la ligne de prestige correspondante dans `arena_prestige_points` (+1 point, `source_type = 'pronostic'`, `source_id` = id du pronostic créé) — pour rester cohérent avec ce que fait la fonction `arena-evaluate-pronostics` quand un pronostic est correct.

Le tout en une seule requête utilisant un CTE `INSERT … RETURNING` pour chaîner les deux inserts.