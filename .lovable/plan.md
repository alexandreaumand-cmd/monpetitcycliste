

# Diagnostic et plan de correction — Ligue SUCEURS_DE_ROUX

## Diagnostic

### Cause racine de l'enchère bloquée
Les 6 managers ont bien validé leurs enchères (6 managers avec des bids `pending` pour l'auction `e8edc66b`). Le mécanisme d'auto-clôture dans `auction-submit-all-bids` a probablement tenté d'appeler `clore-round`, mais cette dernière a échoué en LIVE avec l'erreur **PGRST201** (jointure ambiguë `auctions ↔ phases` causée par les deux FK `phase_id` et `effective_phase_id`).

Le code source est déjà corrigé (`.select('*')` au lieu du join ambigu), mais **la publication vers LIVE est bloquée par le rate limiting** depuis plusieurs tentatives. Les edge functions en LIVE utilisent donc toujours l'ancien code bugué.

### Problème UI secondaire
Le screenshot montre la clé de traduction brute `leagueCard.auction.closingInProgress` — cette clé n'existe pas dans les fichiers i18n (`src/i18n/locales/fr/dashboard.json` ni `en/dashboard.json`).

## Plan de correction

### Étape 1 — Déployer les edge functions en production
Je viens de déployer `clore-round` et `auction-submit-all-bids` en environnement test. Pour que ça passe en LIVE, il faut publier le projet. Le rate limiting devrait être levé maintenant (assez de temps s'est écoulé).

**Action utilisateur requise** : Re-publier le projet depuis l'éditeur.

### Étape 2 — Clôturer manuellement le round bloqué
Une fois la publication effectuée, vous devez vous connecter sur le site LIVE en tant qu'admin de la ligue SUCEURS_DE_ROUX (ou superadmin) et déclencher la clôture depuis l'interface admin. Alternativement, je pourrai appeler `clore-round` via l'outil curl si vous êtes connecté dans le preview.

### Étape 3 — Ajouter les traductions manquantes
Ajouter les clés `openingInProgress` et `closingInProgress` dans les fichiers i18n FR et EN :

**Fichier** : `src/i18n/locales/fr/dashboard.json` (section `leagueCard.auction`)
- `"closingInProgress": "Clôture en cours..."` 
- `"openingInProgress": "Ouverture en cours..."`

**Fichier** : `src/i18n/locales/en/dashboard.json` (section `leagueCard.auction`)
- `"closingInProgress": "Closing in progress..."` 
- `"openingInProgress": "Opening in progress..."`

### Étape 4 — Le round 2 s'ouvrira-t-il automatiquement ?
Le mécanisme d'auto-ouverture du round suivant dépend de `auto-open-scheduled-auctions` (cron). Les logs montrent qu'il tourne toutes les ~20s mais dit "No auctions to open (leagues not active yet)". Après la clôture du round 1 et la mise à jour de `started_at_effective`, le round 2 devrait s'ouvrir automatiquement **si un round 2 a été planifié (statut `scheduled`)**. Sinon, il faudra le créer manuellement depuis l'interface admin.

## Résumé des actions
1. Publier le projet (action utilisateur)
2. Clôturer le round via l'interface admin ou via mon outil curl (une fois connecté)
3. Corriger les 2 clés i18n manquantes (modification code)

