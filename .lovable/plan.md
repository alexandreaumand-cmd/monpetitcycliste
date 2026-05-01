# Plan de correction du classement LIVE MPC 2026

## Ce que je vais corriger

Le problème ne vient pas seulement de l’actualisation automatique.
En LIVE, j’ai confirmé que :

- le cron `refresh-standings-mv` n’existe pas actuellement ;
- le classement général affiché provient bien des vues matérialisées `v_manager_standings_by_season_v2` / `v_manager_standings_by_phase_v2` ;
- le détail d’un manager (`v_manager_breakdown`) donne des totaux plus élevés pour plusieurs managers de MPC 2026 ;
- le classement général stocké est cohérent avec lui-même (saison = somme des phases), mais **pas cohérent avec le détail manager**.

Exemples constatés en LIVE sur MPC 2026 :

- Max : écart de **800 pts**
- Fab : écart de **445 pts**
- Matt L : écart de **255 pts**
- Obi : écart de **215 pts**

Donc la meilleure solution est de **réaligner la logique de calcul**, puis de remettre un refresh fiable.

## Implémentation prévue

### 1. Unifier la source de vérité du classement
Je vais modifier la logique backend pour que le classement général et le détail manager reposent sur **la même base métier**.

Objectif :
- éviter qu’un manager ait un détail correct mais un total général faux ;
- supprimer les divergences entre vue “breakdown” et vues “standings”.

### 2. Corriger le calcul des vues de classement
Je vais recréer la logique de `v_manager_standings_by_season_v2` et `v_manager_standings_by_phase_v2` pour qu’elle applique exactement les mêmes règles de périmètre que le détail manager, y compris pour les ligues à phases comme MPC 2026.

Objectif :
- obtenir les mêmes totaux de points course que le détail manager ;
- conserver les bonus, scoreurs et victoires ;
- garantir une cohérence stable en LIVE.

### 3. Ajouter un mécanisme de recalcul ciblé et vérifiable
Au lieu de dépendre uniquement d’un cron absent ou fragile, je vais prévoir un recalcul robuste :

- refresh général des vues matérialisées ;
- possibilité de recalcul immédiat après correction ;
- vérification que MPC 2026 retourne désormais les bons totaux.

### 4. Remettre l’automatisation correctement
Je vais sécuriser le rafraîchissement automatique pour LIVE :

- recréer le job cron manquant ;
- éviter les doublons de schedule ;
- faire en sorte que l’état soit visible dans la page admin des crons.

### 5. Vérifier spécifiquement MPC 2026 en LIVE
Après la correction, je validerai :

- le classement général de MPC 2026 ;
- la cohérence entre classement général et détail manager ;
- la présence du cron et de sa dernière exécution.

## Détails techniques

- Base concernée : Lovable Cloud LIVE
- Objets concernés :
  - `public.v_manager_breakdown`
  - `public.v_manager_standings_by_season_v2`
  - `public.v_manager_standings_by_phase_v2`
  - `public.refresh_standings_mv()`
  - schedule cron `refresh-standings-mv`
- Approche : correction backend d’abord, pas de contournement frontend
- Validation attendue : égalité entre somme du détail manager et total du classement pour MPC 2026

## Résultat attendu

Le classement général de la ligue MPC 2026 en LIVE sera enfin aligné avec les détails managers, puis restera à jour automatiquement.