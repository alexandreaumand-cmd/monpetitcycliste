## Problème

Le badge "En attente" s'affiche par défaut, le bouton "Renvoyer" n'apparaît jamais, et la modale de détail est vide. La cause : la table `email_send_log` n'autorise en lecture **que le service role**, donc le client (même superadmin) reçoit zéro ligne.

## Solution

Exposer les données du log et du statut aux superadmins via le backend, puis brancher le frontend dessus.

### 1. Backend — autoriser la lecture aux superadmins

Migration SQL : ajouter une policy SELECT sur `public.email_send_log` :
```
USING (is_superadmin())
```
Les autres policies (service_role) restent inchangées.

### 2. Frontend — restaurer affichage et bouton

Une fois la lecture possible, `useCommunicationBatches` et `useCommunicationBatchDetail` retourneront enfin des lignes. Cela suffit à :
- Afficher le badge correct (Envoyé / X en attente / X échec(s))
- Faire apparaître le bouton "Renvoyer" (déjà conditionné sur `failed > 0 || pending > 0`)
- Remplir le tableau "Statut par destinataire" dans la modale

Petits ajustements UI dans `CommunicationHistoryList.tsx` :
- Rendre le bouton "Renvoyer" visible aussi en ligne dans la liste pour les batchs avec uniquement du pending (déjà en place — à vérifier après que les données arrivent).
- Dans la modale : la section "Statut par destinataire" affichera désormais les vraies lignes ; ajouter un libellé clair pour les statuts (`pending` → "En attente", `sent` → "Envoyé", `failed` → "Échec").

### 3. Vérification

Après la migration, recharger l'onglet Historique :
- Le batch "TEST Préprod" doit afficher "2 en attente" (pas "En attente" générique)
- Le bouton "Renvoyer" doit apparaître à droite
- Cliquer sur le batch doit lister les 2 destinataires avec leur statut

## Fichiers touchés

- Nouvelle migration SQL : policy SELECT superadmin sur `email_send_log`
- `src/components/admin/communications/CommunicationHistoryList.tsx` : libellés statut FR dans le tableau
