## Diagnostic

Dans la ligue « Suceurs_de_Roux » :
- `starting_phase_index = 3` et `started_at_effective = 2026-05-08`
- Le Giro d'Italia démarre exactement le `2026-05-08`

Les vues de classement utilisent le filtre strict :

```
c.date_debut > l.started_at_effective
```

Résultat : toute course commençant **le jour même** de `started_at_effective` est exclue. Le Giro (et donc les points de ses managers) est écarté du classement.

Le même bug touche une seconde ligue détectée : « RMC <> La Bordure - Tour AuRA 2026 » (démarrage le 2026-06-04 avec 1 course sur ce jour).

## Correction proposée

Passer le filtre de `>` à `>=` dans les vues de classement, pour inclure les courses commençant exactement à la date de démarrage effective de la ligue (comportement attendu quand on démarre au début d'une phase).

Vues à recréer (branche `starting_phase_index IS NOT NULL`) :
- `v_manager_standings_by_season_v2`
- `v_manager_standings_by_phase_v2`
- `v_manager_standings_total`
- (et toute vue similaire déclarée dans la même migration)

Un seul migration SQL qui réémet ces vues avec `c.date_debut >= l.started_at_effective`.

Aucune modification de données (pas besoin de toucher `started_at_effective`) et aucun changement front. Après application, les classements des deux ligues concernées se remettront automatiquement à jour, Giro d'Italia inclus.
