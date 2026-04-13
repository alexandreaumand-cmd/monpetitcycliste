

# Plan : Gérer les enchères scheduled dont la date est passée

## Situation actuelle
La ligue "La compétition" a une enchère scheduled avec `opens_at` au 10 avril (passé). Le cron `auto-open-scheduled-auctions` aurait dû l'ouvrir mais ne l'a pas fait. Le hook `useLeagueAuctionStatus` filtre avec `.gt('opens_at', now())`, donc cette enchère est invisible → "Aucune donnée disponible".

## Modifications

### 1. `src/hooks/useLeagueAuctionStatus.tsx`
- Retirer le filtre `.gt('opens_at', new Date().toISOString())` sur les enchères scheduled
- Comparer `opens_at` côté client pour ajouter un flag `isPastScheduled: boolean` quand `opens_at < now()`
- Ajouter `isPastScheduled` à l'interface `AuctionStatus`

### 2. `src/components/dashboard/LeagueCard.tsx`
- **Cas `isScheduled && !isPastScheduled`** (date future) : garder le countdown actuel "Ouverture dans X jours"
- **Cas `isPastScheduled`** (date passée) : afficher un bandeau distinct (style gris/neutre) avec le message "Enchère en attente d'ouverture" — indiquant que l'admin doit agir
- **Cas aucune enchère et aucune stat** : remplacer "Aucune donnée disponible" par un message contextuel "La saison vient de commencer ! Les classements apparaîtront après le premier round d'enchères."

### 3. Traductions (`fr/dashboard.json` et `en/dashboard.json`)
- `leagueCard.auction.awaitingOpening` : "En attente d'ouverture" / "Awaiting opening"
- `leagueCard.auction.awaitingOpeningDesc` : "L'enchère devrait bientôt être ouverte par l'administrateur" / "The auction should be opened soon by the administrator"
- `leagueCard.noStatsYet` : "La saison vient de commencer !" / "Season just started!"
- `leagueCard.noStatsYetDesc` : "Les classements apparaîtront après le premier round d'enchères." / "Rankings will appear after the first auction round."

## Fichiers modifiés
1. `src/hooks/useLeagueAuctionStatus.tsx`
2. `src/components/dashboard/LeagueCard.tsx`
3. `src/i18n/locales/fr/dashboard.json`
4. `src/i18n/locales/en/dashboard.json`

