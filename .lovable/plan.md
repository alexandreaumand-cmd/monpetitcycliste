
# Correction du chevauchement header/status bar iOS sur la page Home

## Problème
Sur iOS (notamment en mode PWA), la barre de statut système (batterie, heure, signal) se superpose au header de la page d'accueil car l'espace réservé n'est pas géré.

## Cause racine
Le composant `DashboardHomeHeader.tsx` n'applique pas la classe utilitaire `safe-top` qui est utilisée ailleurs dans l'app (ex: `MobileLayout.tsx`).

## Solution
Ajouter la classe `safe-top` sur le `<header>` du composant `DashboardHomeHeader.tsx` pour les deux versions (mobile et desktop).

## Fichier à modifier

**`src/components/dashboard/DashboardHomeHeader.tsx`**

### Changement mobile (ligne 44)
```tsx
// Avant
<header className="sticky top-0 z-50 bg-black/95 backdrop-blur-sm border-b border-yellow-500/30">

// Après
<header className="sticky top-0 z-50 bg-black/95 backdrop-blur-sm border-b border-yellow-500/30 safe-top">
```

### Changement desktop (ligne 92)
```tsx
// Avant
<header className="sticky top-0 z-50 bg-black/95 backdrop-blur-sm border-b border-yellow-500/30">

// Après
<header className="sticky top-0 z-50 bg-black/95 backdrop-blur-sm border-b border-yellow-500/30 safe-top">
```

## Résultat attendu
- Sur iOS en mode PWA, le header respectera l'espace de la barre de statut
- Sur navigateurs standards, aucun changement visible (la valeur de `env(safe-area-inset-top)` sera 0)
- Cohérence avec le comportement des autres pages de l'application
