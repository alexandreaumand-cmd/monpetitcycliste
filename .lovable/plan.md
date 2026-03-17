

## Problème

La base de données contient des enchères **scheduled** pré-créées pour les phases 2 à 5 de la ligue Early Adopters (opens_at: avril, juillet, octobre 2026, janvier 2027). La logique de fallback introduite dans le dernier fix cherche des enchères scheduled sur **toutes les phases** si aucune n'est trouvée sur la phase active. Elle trouve donc le round scheduled de Phase 2 (ouverture 19 avril) et affiche un countdown de 32 jours.

Ce fallback "toutes phases" est trop agressif pour les enchères **scheduled** — il ne devrait s'appliquer qu'aux enchères **open** (qui nécessitent une action immédiate).

## Correction

**Fichier : `src/hooks/useLeagueCardsData.ts`** (lignes 308-317)

Supprimer le fallback "any phase" pour les enchères scheduled. Ne montrer un countdown scheduled que si l'enchère est sur la phase active calendaire :

```typescript
// Avant (buggy) :
const scheduled = leagueAuctions.find(
  a => ... && a.phase_id === activePhaseId
) || leagueAuctions.find(   // ← ce fallback attrape Phase 2
  a => ... 
);

// Après (corrigé) :
const scheduled = leagueAuctions.find(
  a => a.statut === 'scheduled' && 
       a.opens_at && a.opens_at > now &&
       a.phase_id === activePhaseId
);
// Pas de fallback toutes phases pour scheduled
```

Même correction dans **`src/hooks/useLeagueAuctionStatus.tsx`** (la recherche scheduled) — vérifier que le fallback n'attrape pas des phases lointaines.

**Bonus** : Les clés de traduction `leagueCard.auction.openingIn` et `leagueCard.auction.days` ne sont pas résolues (visible sur le screenshot). Je corrigerai aussi ces traductions manquantes.

**Fichiers modifiés :**
- `src/hooks/useLeagueCardsData.ts`
- `src/hooks/useLeagueAuctionStatus.tsx`
- Fichier(s) de traduction i18n concernés

