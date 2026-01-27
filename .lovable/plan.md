
# Correction du chevauchement iOS sur tout le site

## Problème
La classe `safe-top` a été ajoutée uniquement sur `DashboardHomeHeader`, mais tous les autres headers du site ont le même problème : ils utilisent `sticky top-0` sans gérer le safe-area iOS.

## Solution
Ajouter la classe `safe-top` à **tous** les éléments sticky en haut de page pour garantir que le contenu ne soit jamais coupé par la barre de statut iOS.

## Fichiers à modifier

### 1. Headers principaux (priorité haute)

| Fichier | Ligne | Changement |
|---------|-------|------------|
| `src/components/layout/Header.tsx` | 90 | Ajouter `safe-top` |
| `src/components/layout/TopBar.tsx` | 20 | Ajouter `safe-top` |
| `src/components/admin/SuperAdminHeader.tsx` | 17 | Ajouter `safe-top` |

### 2. Headers Enchères (priorité haute - pages très utilisées)

| Fichier | Ligne | Changement |
|---------|-------|------------|
| `src/components/auction/AuctionHeader.tsx` | 48 | Ajouter `safe-top` |
| `src/components/auction/v2/AuctionHeader.tsx` | 96 | Ajouter `safe-top` |
| `src/components/auction/v2/AuctionHeaderMobile.tsx` | 91 | Ajouter `safe-top` |

### 3. Éléments sticky secondaires (priorité moyenne)

Ces éléments sont positionnés sous un header principal, donc ils n'ont pas besoin de `safe-top` car ils ne sont jamais directement sous la status bar.

| Fichier | Ligne | Action |
|---------|-------|--------|
| `src/components/auction/v2/AuctionTabs.tsx` | 107 | Pas de changement (sous le header) |
| `src/components/auction/v2/AuctionBudgetBanner.tsx` | 32 | Pas de changement (sous le header) |
| `src/components/auction/v2/AuctionRoundsHistory.tsx` | 100 | Ajouter `safe-top` (header de page) |
| `src/pages/ResultsPage.desktop.tsx` | 162 | Pas de changement (sous le header principal) |

## Détails techniques

### Exemple de modification

```tsx
// Avant (Header.tsx ligne 90)
<header className="sticky top-0 z-50 bg-black/95 backdrop-blur-sm border-b border-yellow-500/30">

// Après
<header className="sticky top-0 z-50 bg-black/95 backdrop-blur-sm border-b border-yellow-500/30 safe-top">
```

### Récapitulatif des 7 fichiers à modifier

1. `src/components/layout/Header.tsx` - ligne 90
2. `src/components/layout/TopBar.tsx` - ligne 20
3. `src/components/admin/SuperAdminHeader.tsx` - ligne 17
4. `src/components/auction/AuctionHeader.tsx` - ligne 48
5. `src/components/auction/v2/AuctionHeader.tsx` - ligne 96
6. `src/components/auction/v2/AuctionHeaderMobile.tsx` - ligne 91
7. `src/components/auction/v2/AuctionRoundsHistory.tsx` - ligne 100

## Impact

- Sur iOS PWA : tous les headers respecteront l'espace de la barre de statut
- Sur desktop/Android : aucun changement visible (`env(safe-area-inset-top)` retourne 0)
- Cohérence totale sur toutes les pages de l'application

## Rappel important pour les utilisateurs iOS

Après déploiement, les utilisateurs iOS devront :
1. Supprimer l'app de l'écran d'accueil
2. Réinstaller via Safari → Partager → Sur l'écran d'accueil
