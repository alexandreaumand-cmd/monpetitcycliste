

## Auto-refresh de la page Live toutes les 30 secondes

### Problème

Le hook `useArenaMessages` (ligne 63) utilise `useInfiniteQuery` sans `refetchInterval`. Les messages ne sont chargés qu'au montage — aucun rafraîchissement automatique.

### Changement

**`src/hooks/useArenaMessages.ts`** — ajouter `refetchInterval: 30_000` à la query `useArenaMessages` (ligne 63-97) :

```typescript
return useInfiniteQuery({
  queryKey: ["arena-messages", channelId, leagueId, courseId ?? "all"],
  // ... queryFn inchangé
  enabled: !!channelId && !!leagueId,
  initialPageParam: 0,
  refetchInterval: 30_000, // ← auto-refresh toutes les 30s
});
```

Cela rafraîchira automatiquement la première page de messages (la plus récente) toutes les 30 secondes, ce qui fera apparaître les nouveaux messages de timeline et situations de course sans action de l'utilisateur.

### Fichier impacté
- `src/hooks/useArenaMessages.ts`

