## Problème

Dans la ligue CopaTOUR (mode « À la course », centrée sur le Tour de France), l'onglet « Mon équipe » affiche « Équipe vide » alors que les enchères sont terminées et que 15 coureurs sont bien attribués à chaque manager.

## Cause

L'écran équipe utilise `activePhase` calculée dans `SeasonContext` à partir de la date du jour : aujourd'hui (2 juillet 2026), on tombe dans la **phase 3** de la saison (7 mai → 3 juillet). Or CopaTOUR est scopé sur la **phase 4** uniquement (`league_scopes.phases = [phase 4]`, Tour de France, 4 juillet → 21 août). Résultat : la RPC `manager_team_by_id` est appelée avec la phase 3 → aucun roster → écran vide.

Le sélecteur de phase est aussi masqué en mode `per_course` (`{!isPerCourse && ...}`), donc l'utilisateur ne peut pas corriger manuellement.

## Correctif

Dans `src/contexts/SeasonContext.tsx` :

1. Charger `league_scopes.phases` en même temps que le scope (déjà requêté).
2. Si la ligue a une liste de phases scopées non vide, filtrer `phases` sur cette liste avant de calculer `activePhase`.
3. `computeActivePhase` s'appliquera alors uniquement aux phases pertinentes → CopaTOUR bascule automatiquement sur la phase 4 (prochaine phase à venir dans le sous-ensemble).

Aucun changement d'API pour les composants consommateurs (`phases` et `activePhase` restent exposés). Les ligues multi-phases (ex. MPC 2026 avec toutes les phases dans son scope) ne sont pas impactées.

## Vérification

- Ouvrir CopaTOUR → onglet Équipes : les 15 coureurs de Ludo doivent apparaître pour la phase 4.
- Ouvrir MPC 2026 → onglet Équipes : comportement inchangé, phase active toujours calculée à partir de la date.