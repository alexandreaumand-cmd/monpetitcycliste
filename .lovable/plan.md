# Pourquoi la sauvegarde des résultats est si longue

## Diagnostic (mesuré)

Enregistrer un résultat fait deux choses : l'écriture elle-même (rapide) puis un **recalcul complet du classement** avant de rendre la main. C'est ce recalcul qui coûte tout le temps.

Mesures :
- La requête qui alimente le classement saison met **6,9 s** et lit **6,7 millions de blocs** pour ne produire que 109 lignes.
- La sauvegarde rafraîchit **deux** classements (saison + phase), donc deux fois ce coût.
- Résultat visible dans les journaux : à chaque enregistrement, `refresh_standings_mv` finit en erreur « canceling statement due to statement timeout » après ~8 s. Ce message apparaît pour les 4 maillots enregistrés sur Il Giro d'Abruzzo étape 4, et aussi pour le recalcul des points.

Donc aujourd'hui : l'utilisateur attend ~8 s par enregistrement **et le classement n'est même pas rafraîchi** (le tâche planifiée le fait un peu plus tard).

Cause de la lenteur de la requête : un enchaînement de jointures complètes entre `points_ledger`, `courses`, `phases`, `rosters` et la liste des courses de chaque ligue, sans filtre de saison ni de ligue — tout l'historique est relu à chaque fois (une boucle imbriquée élimine 170 000 lignes inutiles).

## Correction proposée

1. **Ne plus faire attendre l'utilisateur** : l'enregistrement répond dès que les résultats sont écrits, et le rafraîchissement du classement est lancé en tâche de fond. Gain immédiat : la sauvegarde passe de ~8 s à moins d'une seconde.
2. **Rendre le calcul du classement réellement rapide** : filtrer par saison et pré-filtrer les courses de ligue au lieu de relire tout l'historique, et ajouter l'index manquant sur la jointure coureur/phase. Objectif : passer sous la seconde, ce qui supprime aussi les erreurs de délai dépassé.
3. **Vérifier** : mesurer avant/après, puis contrôler dans les journaux qu'il n'y a plus de message de délai dépassé et que le classement se met bien à jour après un enregistrement.

Aucun changement d'affichage, de libellé ou de règle de points.

## Détails techniques

- `supabase/functions/admin-result-save-lot/index.ts` : sortir l'appel `refresh_standings_mv` du chemin bloquant (déclenchement sans `await` bloquant / après réponse), même traitement dans `compute-points`, `admin-recompute-course`, `admin-save-bonus-points`, `recalculate-rider-bonuses`.
- `v_manager_standings_by_season_live` / `..._by_phase_live` : restreindre les CTE `race_pts`, `scoreurs`, `victories` par saison, matérialiser `league_courses` avec `league_id` indexé, et remplacer la boucle imbriquée `p.id = c.phase_id` par une jointure hachée (index sur `points_ledger(coureur_id, course_id)` / `rosters(coureur_id, phase_id)` selon `EXPLAIN`).
- `refresh_standings_cache` : garder le `REFRESH ... CONCURRENTLY` avec repli, mais vérifier que les deux vues matérialisées ont bien un index unique (sinon le `CONCURRENTLY` échoue et déclenche le repli bloquant).
- Validation par `EXPLAIN (ANALYZE, BUFFERS)` avant/après et relecture des journaux de `admin-result-save-lot`.
