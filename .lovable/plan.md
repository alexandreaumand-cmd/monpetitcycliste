

## Supprimer le scroll horizontal sur mobile — Base de données des Enchères

### Problème
Le composant `AuctionDatabaseTab` utilise un `<Table>` HTML avec 7 colonnes, ce qui déborde sur mobile (393px) et force un scroll horizontal.

### Solution
Détecter mobile via `useIsMobile()` et afficher des **cartes compactes** au lieu du tableau :

**`src/components/auction/v2/AuctionDatabaseTab.tsx`** :

1. **Header** : rendre le titre + stats responsive (stack vertical sur mobile au lieu de `flex items-center justify-between`)

2. **Filtres** : déjà en `grid sm:grid-cols-2` → OK, rien à changer

3. **Contenu principal** — sur mobile, remplacer le `<Table>` par une liste de cartes :
   - Chaque carte affiche : nom du coureur, équipe, prix d'achat, manager (badge), round (badge)
   - Cote et nombre de battus en ligne secondaire
   - Tap pour expand les concurrents battus (même logique `expandedRows`)
   - Boutons de tri simplifiés en barre horizontale au-dessus des cartes (tri par Prix, Round, Manager)

4. **Desktop** : garder le tableau existant inchangé

### Fichier impacté
- `src/components/auction/v2/AuctionDatabaseTab.tsx`

