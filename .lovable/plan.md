

## Fix : auto-scroll vers la dernière situation de course sur la page Live Broadcast

### Problème

Quand la page Live Broadcast reçoit une mise à jour (auto-scrape ou import manuel), la situation de course est mise à jour dans le panneau droit mais l'utilisateur doit scroller manuellement vers le haut pour la voir — le contenu au-dessus (sélection de course, barre d'import) pousse le panneau hors de la vue.

### Solution

Deux ajustements dans `SuperAdminLiveBroadcastPage.tsx` :

1. **Rendre le panneau droit sticky** : ajouter `sticky top-20` sur la colonne droite (Situation de course) pour qu'elle reste visible pendant le scroll dans l'historique à gauche

2. **Auto-scroll vers le haut** quand `importedSituation` change : ajouter un `useEffect` qui scroll `window.scrollTo(0, 0)` ou vers le bloc situation quand une nouvelle situation est importée (via scrape)

### Changement concret

```tsx
// Colonne droite : ajouter sticky
<div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
  <Card>
    <CardHeader className="pb-3">
      <CardTitle className="text-base">Situation de course</CardTitle>
    </CardHeader>
    ...
  </Card>
</div>
```

```tsx
// Auto-scroll quand la situation change
useEffect(() => {
  if (importedSituation) {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}, [importedSituation]);
```

### Fichier impacté
- `src/pages/admin/SuperAdminLiveBroadcastPage.tsx` — sticky + auto-scroll

