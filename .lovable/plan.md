

# Plan: Activer le Hall of Fame

## État actuel
- La table `arena_prestige_points` existe (source_type: pronostic, vote_received, reaction_received, bonus)
- **Rien n'écrit dedans** — ni l'évaluation des pronostics, ni les réactions, ni les votes
- Le composant `HallOfFameSection` affiche juste "Coming soon"

## Ce qu'il faut faire

### 1. Attribuer les points de prestige automatiquement

**a) Pronostics corrects (+1 pt)** — Modifier `arena-evaluate-pronostics/index.ts`
- Après le update `is_correct: true`, insérer dans `arena_prestige_points` pour chaque pronostic correct (source_type='pronostic', source_id=pronostic_id)
- Nécessite de connaître le `league_id` → le récupérer depuis les pronostics

**b) Réactions reçues (+1 pt)** — Créer un trigger SQL `on INSERT on arena_reactions`
- Insère un point prestige pour le manager auteur du message réactionné (source_type='reaction_received', source_id=reaction_id)
- Supprime le point `on DELETE` de la réaction (idempotent)

**c) Votes MVP reçus (+2 pts)** — Créer un trigger SQL `on INSERT on arena_poll_votes`
- Pour les polls de type MVP, attribue 2 pts au manager voté (source_type='vote_received', source_id=vote_id)
- Note: nécessite d'identifier les "polls MVP" — on peut utiliser le champ existant ou ajouter un flag. Pour simplifier, on skip ce point dans un premier temps et on se concentre sur pronostics + réactions.

### 2. Créer le hook `usePrestigeStandings`
- Query `arena_prestige_points` groupé par `manager_id` avec SUM(points)
- Join sur `managers` pour nom + avatar
- Retourne le classement trié par points décroissants

### 3. Refaire le composant `HallOfFameSection`
- Classement avec podium visuel (🥇🥈🥉) pour le top 3
- Liste scrollable pour le reste
- Détail par source_type (breakdown: X pronostics, Y réactions)
- État vide si aucun point

### 4. Traductions
- Ajouter les clés fr/en pour le leaderboard, les labels de source, etc.

## Fichiers impactés

| Fichier | Action |
|---|---|
| `supabase/functions/arena-evaluate-pronostics/index.ts` | Modifier — insérer prestige points après évaluation |
| Migration SQL | Créer — trigger pour réactions → prestige points |
| `src/hooks/usePrestigeStandings.ts` | Créer — hook d'agrégation |
| `src/components/arena/HallOfFameSection.tsx` | Réécrire — leaderboard complet |
| `src/i18n/locales/fr/arena.json` | Modifier — clés hallOfFame |
| `src/i18n/locales/en/arena.json` | Modifier — clés hallOfFame |

