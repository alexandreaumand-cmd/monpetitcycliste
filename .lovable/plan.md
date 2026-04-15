

# Fix : Annonces invisibles — Correction du join PostgREST ambigu

## Diagnostic confirmé

Le problème est **identique pour tous les modes de ligue** (5 phases et à la course). Les auctions "à la course" ont aussi un `phase_id` en base (colonne NOT NULL). Le bug est purement technique :

La ligne 53 de l'Edge Function utilise `phases!inner(saison_id)`, mais la table `auctions` a **deux FK vers `phases`** (`phase_id` et `effective_phase_id`). PostgREST ne peut pas deviner laquelle utiliser et renvoie une erreur, ce qui fait que l'auction n'est pas trouvée → 404 → aucune annonce affichée.

## Correction

### 1. `supabase/functions/auction-get-live-status/index.ts`

Ligne 53 — désambiguïser le join :
```typescript
// Avant :
.select('*, phases!inner(saison_id), paused_manager:announcements_paused_by(id, nom)')

// Après :
.select('*, phases!phase_id(saison_id), paused_manager:announcements_paused_by(id, nom)')
```

### 2. Audit des autres Edge Functions

Rechercher et corriger toute occurrence de `phases!inner` dans les autres Edge Functions qui interrogent la table `auctions`.

## Fichiers modifiés
1. `supabase/functions/auction-get-live-status/index.ts` — 1 ligne modifiée
2. Éventuellement d'autres Edge Functions si le même pattern est trouvé

