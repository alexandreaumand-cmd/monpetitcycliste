## Problème

La carte "Enchères programmées" du dashboard s'affiche même si l'ouverture est dans 31 jours. Le correctif précédent n'a été appliqué qu'à `useLeagueAuctionStatus` (utilisé sur la page Enchères), mais le dashboard utilise un autre hook batch `useLeagueCardsData` qui n'a pas la limite.

## Correction

Dans `src/hooks/useLeagueCardsData.ts` (~ligne 293-296), lors de la sélection de l'enchère `scheduled` à afficher, ajouter un filtre pour ne garder que celles dont `opens_at` est à moins de 10 jours du maintenant :

```ts
const now = new Date();
const VISIBILITY_MS = 10 * 24 * 60 * 60 * 1000;
const scheduled = leagueAuctions
  .filter(a =>
    a.statut === 'scheduled' &&
    a.opens_at &&
    new Date(a.opens_at).getTime() > now.getTime() &&
    new Date(a.opens_at).getTime() - now.getTime() <= VISIBILITY_MS
  )
  .sort((a, b) => (a.opens_at || '').localeCompare(b.opens_at || ''))[0];
```

Aucune autre modif. Résultat : les cartes de ligue sur `/dashboard/home` masqueront les enchères programmées tant qu'il reste plus de 10 jours avant leur ouverture, cohérent avec la page Enchères.
