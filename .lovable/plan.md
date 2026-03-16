

## Plan : Mettre à jour les icônes PWA

Le logo carré uploadé doit remplacer les icônes PWA actuelles (`pwa-192x192.png` et `pwa-512x512.png`) référencées dans `vite.config.ts`.

### Modifications

1. **Copier le logo** vers `public/pwa-192x192.png` et `public/pwa-512x512.png` (remplace les fichiers existants)
2. **Mettre à jour `public/favicon.png`** avec ce même logo (cohérence)
3. Aucun changement de code nécessaire — les noms de fichiers restent identiques dans `vite.config.ts`

