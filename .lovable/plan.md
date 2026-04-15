

# Diagnostic : Lenteurs de chargement sur le dashboard, classement et équipes

## Cause racine

### 1. Dashboard — `useLeagueCardsData` : cascade séquentielle de 9+ requêtes
Le hook exécute **9 requêtes en série** (chaque `await` bloque la suivante) :
1. `auth.getUser()` → 2. `managers` (current) → 3. `league_members` → 4. `managers` (noms) → 5. `managers` (owners) → 6. `league_scopes` → 7. `saisons` → 8. `courses` → 9. `v_manager_standings` → 10. `phases` → 11. `auctions` → 12. `annonces` → 13. Edge Function `auction-get-validation-status` (par auction ouverte)

Avec ~100-200ms par requête, cela fait **1.5 à 3 secondes** de waterfall minimum. Le `staleTime` de 30 secondes aggrave le problème (rechargement fréquent).

### 2. Classement et Équipes — même pattern
Les pages `Rankings.mobile.tsx` et `MyTeam.mobile.tsx` dépendent du `LeagueContext` et `SeasonContext` qui doivent d'abord se résoudre avant de lancer leurs propres requêtes, créant un waterfall supplémentaire.

### 3. Vues matérialisées
Les standings utilisent des vues matérialisées (rapides <100ms), donc le problème n'est pas la base de données mais le **nombre de round-trips réseau séquentiels**.

---

## Solutions proposées

### Solution A — Paralléliser les requêtes dans `useLeagueCardsData` (impact fort, facile)
Regrouper les requêtes indépendantes avec `Promise.all` :

```text
Étape 1 (parallèle): auth.getUser + league_members + league_scopes + managers(owners)
Étape 2 (parallèle): managers(noms) + saisons + courses + standings + phases + auctions
Étape 3 (parallèle): annonces + validation-status
```

Cela réduirait le temps de ~2.5s à ~0.6s (3 round-trips au lieu de 13).

### Solution B — Augmenter le `staleTime` du dashboard (impact moyen, trivial)
Passer le `staleTime` de 30s à **2-5 minutes**. Les données du dashboard (membres, standings, saison) changent rarement. Cela évitera les rechargements à chaque retour sur la page.

### Solution C — Augmenter le `staleTime` des classements et équipes (impact moyen, trivial)
Les standings et rosters ont déjà 60s de cache. Passer à **2-5 minutes** pour réduire les rechargements inutiles.

### Solution D — Prefetch au login (impact moyen)
Dans le `Dashboard.tsx`, lancer un prefetch des données de classement et équipe pendant que l'utilisateur voit le dashboard, pour que la navigation soit instantanée.

---

## Plan d'implémentation recommandé

### 1. `src/hooks/useLeagueCardsData.ts` — Parallélisation des requêtes
Restructurer la `queryFn` en 3 étapes `Promise.all` au lieu de 13 `await` séquentiels. Augmenter `staleTime` de 30s à 5 minutes.

### 2. `src/pages/Rankings.mobile.tsx` — Augmenter le staleTime
Passer de 60s à 2 minutes pour les requêtes standings et top-riders.

### 3. `src/components/team/MyTeam.mobile.tsx` — Augmenter le staleTime
Passer de 5 minutes (déjà correct pour les riders) — vérifier les autres requêtes de la page.

## Fichiers modifiés
1. `src/hooks/useLeagueCardsData.ts` — parallélisation + staleTime
2. `src/pages/Rankings.mobile.tsx` — staleTime
3. `src/components/team/MyTeam.mobile.tsx` — staleTime (si nécessaire)

