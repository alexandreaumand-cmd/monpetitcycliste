# Sécuriser la réparation automatique des points Porteur

## Problème
La fonction serveur `auto-fix-missing-porteur-points` ne vérifie pas qui l'appelle. N'importe qui connaissant l'adresse publique de l'app peut donc déclencher un recalcul massif des points et réécrire le journal des points.

## Correction proposée
1. Ajouter un contrôle d'accès en tête de la fonction, sur le modèle déjà utilisé par `compute-bonus-scoreurs` :
   - récupérer l'utilisateur depuis le jeton d'authentification (`auth.getUser()`) ; si absent ou invalide → réponse 401 « Non authentifié » ;
   - vérifier `is_superadmin()` ; si faux → réponse 403 « Accès refusé » ;
   - aucun appel aux RPC de calcul avant ces deux vérifications.
2. Conserver un chemin d'appel automatisé si besoin : accepter aussi un en-tête `x-cron-secret` correspondant au secret `CRON_SECRET` (utilisé par les tâches planifiées). Si ce secret n'existe pas encore, je le demanderai avant l'implémentation.
3. Garder les en-têtes CORS sur toutes les réponses, y compris 401/403.
4. Journaliser l'opération dans `audits` avec le manager déclencheur, comme les autres actions d'administration.
5. Vérifier après déploiement : appel sans jeton → 401, appel avec un compte non-admin → 403, appel super-admin → réparation exécutée. Puis marquer l'alerte de sécurité comme corrigée.

## Détails techniques
- Fichier : `supabase/functions/auto-fix-missing-porteur-points/index.ts`
- Client utilisateur (clé anon + Authorization) pour `auth.getUser()` et `is_superadmin()` ; client service role uniquement après validation, pour les RPC `find_courses_missing_porteur_points` et `admin_compute_points_for_course`.
- Aucun changement de base de données, ni de logique de calcul des points. Le bouton « Réparer points Porteur » de la page maintenance continue de fonctionner (il envoie déjà le jeton de session).
