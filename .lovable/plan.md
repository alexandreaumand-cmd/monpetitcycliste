

# Restaurer le Startlist Tracker en Live

## Diagnostic

Le cron job `startlist-tracker-sync` fonctionne correctement toutes les 5 minutes (confirme par `cron.job_run_details` et `net._http_response`). La fonction edge s'execute, traite des courses, et retourne des `run_id` valides. **Mais ces `run_id` n'existent pas dans la base Live** -- la fonction ecrit dans un environnement different depuis son redeploiement automatique (cause par les corrections dark mode).

## Plan de correction

### Etape 1 : Corriger l'erreur de build (bloquante pour la publication)

**Fichier** : `src/hooks/usePushNotifications.ts`

Le type TypeScript de `ServiceWorkerRegistration` ne reconnait pas `pushManager`. Il faut ajouter un cast `as any` ou une declaration de type aux 4 endroits (lignes 91, 154, 234, 274).

### Etape 2 : Publier le projet

Une fois le build corrige, publier le projet. Cela synchronisera la fonction edge `startlist-tracker` vers l'environnement Live, afin qu'elle ecrive a nouveau dans la bonne base de donnees.

### Etape 3 : Verification

Apres publication, verifier que les nouvelles executions apparaissent bien dans l'historique du Startlist Tracker (onglet "Historique") dans les 5 minutes suivantes.

## Details techniques

- La correction de `pushManager` utilise un cast `(registration as any).pushManager` pour contourner le type TypeScript incomplet
- Aucune modification de la fonction edge `startlist-tracker` elle-meme n'est necessaire
- Le cron job en base Live n'a pas besoin d'etre touche -- il fonctionne deja

