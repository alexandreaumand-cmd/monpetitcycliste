
Cause probable (et vérifiée) : le lien `monpetitcycliste.lovable.app` semble être rattaché au domaine principal `labordure.app`.  
Quand ce domaine principal a un problème SSL/DNS, l’accès via le lien `lovable.app` peut échouer aussi.

Ce que j’ai constaté :
- L’URL publiée répond bien côté infrastructure.
- Le contenu servi depuis `monpetitcycliste.lovable.app` pointe vers `labordure.app` (indices d’un domaine principal/custom domain actif).
- Donc le blocage vient très probablement de la config domaine/certificat, pas du code applicatif.

Plan de correction (sans changement de code) :
1. Ouvrir **Settings → Domains**.
2. Vérifier l’état de `labordure.app` et `www.labordure.app` :
   - objectif : **Active**
   - si **Verifying / Failed / Offline**, corriger DNS.
3. Chez le registrar DNS, vérifier strictement :
   - `A @` → `185.158.133.1`
   - `A www` → `185.158.133.1`
   - `TXT _lovable` → valeur de vérification fournie dans l’UI
4. Supprimer les conflits éventuels :
   - anciens `A/AAAA/CNAME` sur `@` ou `www`
   - `CAA` qui bloque Let’s Encrypt
5. Revenir dans l’UI Domains et cliquer **Retry** si proposé.
6. Tester ensuite en navigation privée + autre réseau (4G) pour éviter cache DNS/SSL local.

Détails techniques :
- Si un custom domain est défini comme domaine principal, le domaine `*.lovable.app` peut dépendre de cette config de publication/routage.
- Une erreur SSL sur le domaine principal peut donner l’impression que le lien `lovable.app` “ne marche pas”.
- Tant que le statut domaine n’est pas **Active**, l’accès peut être intermittent ou bloqué selon les navigateurs/réseaux.

Si tu veux, dès que tu m’envoies une capture de l’état exact de la page **Domains** (statuts affichés), je te donne la correction DNS ligne par ligne.
