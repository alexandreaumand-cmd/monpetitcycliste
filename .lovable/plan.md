

## Fix desktop : titre "Timeline" + messages récents en haut

### Problème

Sur desktop, la colonne messages n'a pas de titre "Timeline", et les messages sont affichés du plus ancien au plus récent avec auto-scroll vers le bas — l'utilisateur doit scroller pour voir les derniers messages.

### Changements dans `src/components/arena/LiveCoursesTab.tsx`

**1. Ajouter un header "Timeline"** entre le stage filter et le feed de messages (ligne ~282) :
```tsx
<div className="px-4 py-3 border-b bg-muted/20">
  <div className="flex items-center gap-2">
    <MessageCircle className="h-4 w-4 text-primary" />
    <h3 className="text-sm font-semibold">Timeline</h3>
  </div>
</div>
```

**2. Afficher les messages récents en haut** : ligne 82, supprimer le `.reverse()` pour desktop — garder l'ordre DB (newest first) pour les deux layouts :
```typescript
const displayMessages = useMemo(() => {
  return filteredMessages;
}, [filteredMessages]);
```

**3. Supprimer l'auto-scroll desktop** : supprimer le `useEffect` lignes 98-102 qui scroll vers le bas, et le handler `handleScroll` / `autoScroll` state devenus inutiles.

### Fichier impacté
- `src/components/arena/LiveCoursesTab.tsx`

