

## Coller la barre de recherche au header (Résultats mobile)

### Problème

Sur la page Résultats mobile, la barre de recherche `sticky top-14` ne colle pas directement sous le header. Un espace de fond crème est visible entre les deux.

### Cause probable

Le composant `AdminMaintenance` est rendu avant la barre de recherche dans le flux. Même s'il retourne `null` pour les non-admins, la structure flex peut créer un décalage. De plus, le `py-2` sur le conteneur de recherche ajoute du padding superflu en haut.

### Solution

1. **Déplacer `AdminMaintenance`** après la barre de recherche sticky (ou à l'intérieur de la zone scrollable)
2. **Réduire le padding** du conteneur de recherche : remplacer `py-2` par `py-2 pt-0` ou `pb-2` pour que la barre soit collée au bord supérieur

### Fichier impacté

- `src/pages/ResultsPage.mobile.tsx` — Réorganiser l'ordre des éléments et ajuster le padding

