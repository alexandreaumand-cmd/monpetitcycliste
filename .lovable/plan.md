

## Fix : ordre des messages inversé sur mobile

### Problème

La requête Supabase retourne les messages triés par `created_at DESC` (le plus récent en premier). Ensuite dans `LiveCoursesTab.tsx` ligne 82 :

```typescript
return isMobile ? [...filteredMessages].reverse() : filteredMessages;
```

Le `.reverse()` remet les messages dans l'ordre chronologique (ancien en haut) — l'inverse de ce qui est voulu.

### Solution

Supprimer le `.reverse()` sur mobile. Les messages sont déjà dans le bon ordre (newest first) grâce à la requête DB. Sur desktop, il faut garder le `.reverse()` pour l'ordre chronologique (ancien en haut, scroll vers le bas).

### Changement

**`src/components/arena/LiveCoursesTab.tsx`** ligne 81-83 — inverser la logique :

```typescript
// On desktop, reverse to chronological (oldest first, scroll down); on mobile, keep DB order (newest first)
const displayMessages = useMemo(() => {
  return isMobile ? filteredMessages : [...filteredMessages].reverse();
}, [filteredMessages, isMobile]);
```

