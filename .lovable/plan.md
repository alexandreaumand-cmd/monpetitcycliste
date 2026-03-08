

# Plan: Pronostics TTT (Team Time Trial)

## Contexte
Certaines étapes sont des contre-la-montre par équipes (TTT). Le super admin doit pouvoir marquer une étape comme TTT, et les managers doivent alors choisir une équipe (pas un coureur) pour leur pronostic.

## Modifications base de données

### 1. Table `arena_pronostic_deadlines`
- Ajouter colonne `is_ttt BOOLEAN NOT NULL DEFAULT false`

### 2. Table `arena_pronostics`
- Ajouter colonne `equipe_saison_id UUID NULL REFERENCES equipes_saisons(id)`
- Rendre `coureur_id` nullable (actuellement NOT NULL avec FK vers coureurs)
- Contrainte : soit coureur_id soit equipe_saison_id doit être renseigné

## Modifications Frontend

### 3. Admin - PronosticDeadlinesManager.tsx
- Ajouter une case à cocher "TTT" sur chaque ligne d'étape (stage_winner uniquement)
- Stocker l'état TTT dans les overrides et l'inclure lors de l'insertion des deadlines

### 4. Hook useArenaPronostics.ts
- Mettre à jour `PronosticDeadline` pour inclure `is_ttt`
- Ajouter le champ dans les requêtes select
- Ajouter un hook `useStartlistTeams(courseId)` qui retourne les équipes distinctes présentes sur la startlist
- Adapter `useSavePronostic` pour gérer `equipe_saison_id` au lieu de `coureur_id` quand TTT
- Adapter `useMyPronostics` pour récupérer le nom d'équipe quand TTT
- Adapter `useLeaguePronostics` pour afficher le nom d'équipe quand TTT

### 5. Nouveau composant PronosticStartlistTeamCombobox.tsx
- Combobox similaire à PronosticStartlistCombobox mais affichant les équipes de la startlist
- Déduplique les équipes à partir des `source_team` des startlist_entries + matching vers `equipes_saisons`

### 6. PronosticRaceCard.tsx
- Conditionner le rendu : si `deadline.is_ttt`, afficher le combobox équipe au lieu du combobox coureur
- Adapter l'affichage du résultat (nom d'équipe au lieu de nom de coureur)

### 7. Edge Function arena-evaluate-pronostics
- Adapter pour les TTT : le gagnant est une équipe (position 1 dans race_results avec type TTT)
- Comparer `equipe_saison_id` des pronostics avec l'équipe du coureur gagnant

## Détails techniques

```text
arena_pronostic_deadlines
├── + is_ttt (boolean, default false)

arena_pronostics  
├── coureur_id (text, NOW NULLABLE)
├── + equipe_saison_id (uuid, nullable, FK → equipes_saisons)
├── + CHECK: coureur_id IS NOT NULL OR equipe_saison_id IS NOT NULL

Flow TTT:
Admin coche TTT → deadline.is_ttt = true
Manager ouvre pronostic → voit combobox équipes (depuis startlist)
Manager choisit équipe → arena_pronostics.equipe_saison_id = <id>
Évaluation → compare equipe_saison_id avec l'équipe du vainqueur TTT
```

