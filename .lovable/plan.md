

# Plan : Ajouter le détail de la ligue dans le SuperAdminAuctionsMonitor

## Contexte
Actuellement, chaque carte d'enchère affiche uniquement le nom de la ligue, le round, la deadline et le statut de validation. L'utilisateur souhaite voir aussi le **mode de jeu** et les **courses sélectionnées** (pour les ligues "à la course").

## Modifications

### Fichier unique : `src/components/admin/auctions/SuperAdminAuctionsMonitor.tsx`

1. **Enrichir la requête leagues** : au lieu de `select("id, name")`, récupérer `select("id, name, game_mode, settings, league_scopes(selected_course_ids)")` pour obtenir le mode et les IDs des courses sélectionnées.

2. **Récupérer les noms des courses** : collecter tous les `selected_course_ids` de toutes les ligues, puis faire une requête sur la table `courses` pour obtenir les noms correspondants.

3. **Enrichir l'interface `AuctionWithLeague`** : ajouter `game_mode`, `courses` (tableau de noms de courses), `budget`, `max_riders`.

4. **Afficher dans chaque carte** :
   - Badge du mode de jeu (ex: "À la course", "5 Phases") sous le nom de la ligue
   - Budget et max coureurs (depuis `settings`)
   - Pour les ligues "per_course" : liste des courses sélectionnées (noms) en badges compacts ou liste à puces

## Rendu visuel attendu
Sous le nom de la ligue, une ligne de badges :
- `À la course` ou `5 Phases` (mode)
- `Budget: 650M€` / `Max: 8 coureurs`
- Liste des courses (si per_course) en texte compact

