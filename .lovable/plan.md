

## Problème

À l'ouverture de la PWA, l'utilisateur voit **3 écrans de chargement successifs** :

1. **Suspense fallback** (`LoadingSpinner`) — fond blanc, logo rose, pendant le lazy-load de `Index.tsx`
2. **Index.tsx loading** — fond vert (`bg-secondary`), logo rose, pendant la vérification de session auth
3. **Dashboard loading** — fond blanc, simple spinner "Chargement...", pendant le chargement du manager/rôle

Chacun a un style différent, ce qui crée un effet de "flash" entre écrans.

## Solution

Unifier tous les écrans de chargement en **un seul design cohérent** : fond Cream (`#F5F0E8`), nouveau logo casquette, spinner gold, citations cyclistes.

### Étapes

1. **Copier le nouveau logo** uploadé dans `src/assets/logo-carre-sans-marque.png`

2. **Refactorer `LoadingSpinner`** pour qu'il devienne le composant de splash unique :
   - Fond plein écran `min-h-screen` avec couleur Cream (`bg-[#F5F0E8]`)
   - Nouveau logo casquette centré (import `logo-carre-sans-marque.png`)
   - Spinner gold
   - Citations cyclistes rotatives (déjà en place)

3. **Aligner `Index.tsx`** loading screen :
   - Remplacer le bloc `isLoading` par `<LoadingSpinner />` directement (évite la duplication)
   - Supprimer le logo rose et le code de citations dupliqué dans Index

4. **Aligner `Dashboard.tsx`** loading screen :
   - Remplacer le spinner basique (lignes 66-74) par `<LoadingSpinner />`

5. **Résultat** : un seul composant `LoadingSpinner` utilisé partout — Suspense, Index, Dashboard — même design, transition invisible entre les phases de chargement.

### Fichiers modifiés

| Fichier | Modification |
|---|---|
| `src/assets/logo-carre-sans-marque.png` | Nouveau logo casquette |
| `src/components/shared/LoadingSpinner.tsx` | Full-screen, fond Cream, nouveau logo, spinner gold |
| `src/pages/Index.tsx` | Utiliser `<LoadingSpinner />` au lieu du bloc custom |
| `src/pages/Dashboard.tsx` | Utiliser `<LoadingSpinner />` au lieu du spinner basique |

