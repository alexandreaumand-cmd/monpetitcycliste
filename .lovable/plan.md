
# Stabiliser définitivement les récaps LIVE (quotidien + hebdo)

## Diagnostic confirmé
- Les récaps ont bien été générés en **Test** (35 messages système depuis le 19/03), mais **pas en LIVE** (0 message système depuis le 19/03).
- Les jobs cron LIVE existent et sont actifs, mais il manque de la visibilité opérationnelle pour prouver l’exécution (ou l’échec) en production au moment voulu.

## Plan d’implémentation

### 1) Fiabiliser l’exécution LIVE de `arena-recaps`
- Garder la logique d’auth déjà simplifiée (compatible appel cron avec Bearer anon).
- Ajouter dans la réponse JSON un champ explicite de contexte d’exécution (`env`, `project_ref`, `timestamp`, `type`) pour éviter toute confusion Test/LIVE lors des relances manuelles.

### 2) Ajouter une traçabilité persistante des runs (audit)
- Créer une table d’audit dédiée (ex: `arena_recap_runs`) avec :
  - type (`daily`/`weekly`)
  - date ciblée
  - environnement
  - nb ligues traitées / nb envoyées
  - statut (`success`, `partial`, `error`)
  - message d’erreur éventuel
  - timestamps
- Dans `arena-recaps`, écrire un enregistrement d’audit à chaque exécution (succès et échec).

### 3) Ajouter un watchdog automatique
- Créer un job planifié “contrôle” après les horaires attendus :
  - quotidien vers 20:10 UTC
  - hebdo le dimanche vers 20:25 UTC
- Si aucun run `success/partial` n’existe pour la fenêtre attendue, déclencher une alerte (message système admin / notification) pour agir immédiatement.

### 4) Vérification fonctionnelle LIVE (E2E)
- Effectuer un test manuel LIVE `daily` et `weekly` (avec timeout 30s) et vérifier :
  - insertion dans `arena_messages` (type `system`)
  - insertion dans `arena_recap_runs`
  - affichage dans l’onglet Arène de la ligue MPC 2026.
- Puis laisser tourner le cron du soir et valider le run automatique via l’audit.

## Fichiers / éléments à modifier
- `supabase/functions/arena-recaps/index.ts` (payload de réponse + écriture audit)
- Nouvelle migration SQL (table `arena_recap_runs` + index)
- Configuration cron LIVE (watchdog additionnel)

## Résultat attendu
- Les récaps quotidien et hebdo fonctionnent en LIVE de façon vérifiable.
- En cas de panne, détection automatique en quelques minutes, sans attendre plusieurs jours.
- Plus d’ambiguïté Test vs LIVE lors des relances manuelles.
