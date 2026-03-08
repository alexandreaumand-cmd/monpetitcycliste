

# Plan: Classement visuel "Route de montagne" avec vélos

## Concept
Un nouveau composant visuel SVG représentant une route de col de montagne sinueuse (inspirée de l'image). Chaque manager est un vélo positionné le long de la route, avec des écarts proportionnels aux points. Sélecteur total / par phase intégré.

## Nouveau composant : `src/components/rankings/MountainRoadStandings.tsx`

### Visuel
- Route sinueuse SVG en lacets (type col alpin), du bas vers le haut
- Chaque manager = un vélo 🚴 positionné sur la route, avec son nom à côté
- Le leader est en haut (proche du sommet), le dernier en bas
- Les écarts entre les vélos sont proportionnels aux écarts de points
- Couleurs podium (or/argent/bronze) pour les 3 premiers
- Responsive : fonctionne en mobile et desktop

### Sélecteur intégré
- Tabs en haut : "Total" | phases individuelles (Phase 1, Phase 2...)
- Réutilise `useSeasonContext()` pour les phases et `useLeague()` pour le leagueId
- Appelle `v_manager_standings_by_season_v2` (total) ou `v_manager_standings_by_phase_v2` (par phase)

### Données
- Récupère standings + avatar_url depuis managers
- Calcule les écarts relatifs : `(leader_points - manager_points) / leader_points` pour positionner les vélos

## Intégration
- Ajouter un onglet "mountain" ou "visual" dans `Rankings.mobile.tsx` dans les `tabChips`
- Ou l'afficher directement en haut de la page classement comme un header visuel

## Fichiers impactés

| Fichier | Action |
|---|---|
| `src/components/rankings/MountainRoadStandings.tsx` | **Créer** — Composant SVG route de montagne avec vélos |
| `src/pages/Rankings.mobile.tsx` | **Modifier** — Ajouter onglet/tab "Route" pour afficher le visuel |

