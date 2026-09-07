# Sécuriser le scraper d'abandons de startlist

## Problème
La fonction serveur `scrape-startlist-abandons` ne vérifie pas qui l'appelle. N'importe qui peut donc la déclencher et faire écrire des abandons (DNF/DNS) dans les startlists, en contournant toutes les règles d'accès.

## Constat vérifié
- La fonction crée directement un client à privilèges élevés, sans aucun contrôle d'authentification.
- Côté application, elle n'est déclenchée que par le bouton « Vérifier abandons PCS », réservé aux super-admins.
- Une tâche planifiée quotidienne (17h00 UTC) l'appelle aussi, actuellement sans en-tête secret.
- Un secret de tâches planifiées existe déjà dans le projet et est utilisé par d'autres tâches (injuries, live).

## Correction proposée
1. Ajouter un contrôle d'accès en tête de la fonction, identique à celui déjà en place sur la réparation des points Porteur :
   - soit un en-tête secret de tâche planifiée valide (`x-cron-secret`),
   - soit un jeton de session valide dont l'utilisateur est super-admin ;
   - sinon : réponse 401 (non authentifié) ou 403 (accès refusé), avant toute création de client à privilèges élevés et tout appel externe.
2. Autoriser l'en-tête `x-cron-secret` dans les en-têtes CORS, et conserver les en-têtes CORS sur toutes les réponses y compris les erreurs.
3. Mettre à jour la tâche planifiée quotidienne pour qu'elle envoie ce même en-tête secret (sinon le contrôle automatique quotidien cesserait de fonctionner).
4. Journaliser l'exécution manuelle dans la table d'audits, avec le super-admin déclencheur.
5. Vérifier après déploiement : appel sans jeton → 401, appel avec un compte non super-admin → 403, appel super-admin → scraping exécuté, appel avec le secret → exécuté. Puis marquer l'alerte comme corrigée.

## Détails techniques
- Fichier : `supabase/functions/scrape-startlist-abandons/index.ts` (même schéma que `auto-fix-missing-porteur-points`).
- Secret réutilisé : `LIVE_BROADCAST_CRON_SECRET` (déjà présent), valeur identique à celle des autres tâches planifiées ; migration/SQL pour recréer le job `scrape-startlist-abandons-daily` avec l'en-tête.
- Aucun changement du parsing PCS ni de la logique d'écriture des abandons. Le bouton super-admin continue de fonctionner (il envoie déjà le jeton de session).
