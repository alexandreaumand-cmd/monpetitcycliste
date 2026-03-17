

## Problème identifié

Le Round 1 de la Phase 2 est bien **ouvert** en base de données (deadline 19 mars). Mais l'UI ne le montre pas car :

1. **`useLeagueAuctionStatus`** (hook joueur) détermine la phase active par les dates du calendrier. Aujourd'hui (17 mars) tombe dans Phase 1 (1 jan - 21 mars). Il filtre les enchères ouvertes par `phase_id = Phase 1`, ignorant le round ouvert de Phase 2.

2. **`RoundControlCenter`** (admin) auto-sélectionne la phase avec `statut === 'active'`, qui est Phase 1. L'admin doit manuellement changer vers Phase 2 pour voir le round.

## Corrections

### 1. `src/hooks/useLeagueAuctionStatus.tsx` — Chercher d'abord TOUT round ouvert

Modifier la logique pour chercher en priorité une enchère ouverte **toutes phases confondues** avant de filtrer par phase calendaire. Si un round est ouvert sur n'importe quelle phase, c'est celui-là qui doit être affiché.

```
Logique actuelle : déterminer phase active → chercher open auction sur cette phase
Logique corrigée : chercher open auction toutes phases → si trouvée, l'utiliser ; sinon, fallback sur la phase calendaire pour scheduled/closed
```

### 2. `src/components/admin/RoundControlCenter.tsx` — Auto-sélection intelligente

Modifier l'auto-sélection pour détecter s'il existe un round ouvert sur une autre phase et la pré-sélectionner automatiquement, plutôt que de toujours sélectionner la phase "active" par statut.

**Fichiers modifiés :**
- `src/hooks/useLeagueAuctionStatus.tsx`
- `src/components/admin/RoundControlCenter.tsx`

