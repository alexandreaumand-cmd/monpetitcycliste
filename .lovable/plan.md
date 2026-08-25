# Garder la ligue courante en ouvrant une fiche manager

## Problème

Depuis un classement, le clic sur l'icône de profil navigue vers `/dashboard/manager/:id` sans le paramètre `leagueId`. Le contexte de ligue lit d'abord l'URL ; en son absence il retombe sur la ligue préférée du compte (ici « MPC 2026 »). La fiche affiche donc les données d'une autre ligue que celle consultée (CopaVUELTA).

## Correction

Conserver la ligue active dans l'URL de destination sur les trois points d'entrée existants :

- `src/components/rankings/ManagerNameWithJersey.tsx`
- `src/components/rankings/ManagerStandings.tsx`
- `src/pages/Rankings.mobile.tsx`

Chacun navigue vers `/dashboard/manager/:id?leagueId=<ligue courante>` en récupérant `leagueId` via `useLeague()` (ajout uniquement là où le hook n'est pas déjà présent), et n'ajoute le paramètre que s'il est défini.

## Détails techniques

Le paramètre suffit : `ManagerProfile.tsx` consomme déjà `useLeague()` pour tous ses appels (`_league_id`), et `LeagueProvider` donne la priorité à `?leagueId` de l'URL. Aucun changement de logique métier ni de requête n'est nécessaire.
