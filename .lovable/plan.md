

## Ajouter les barèmes 2.Pro et 1.1 à la section preview de la landing page

### Contexte

Actuellement, `BaremePreviewSection` ne montre que le barème Grand Tour (CG, Étapes, Maillots). L'utilisateur veut illustrer les différences avec des catégories inférieures.

### Données à ajouter

**2.Pro (Tour par étapes)** — top 5 :
- CG : 250, 200, 150, 120, 100
- Étape : 150, 125, 100, 75, 60

**1.1 (Course d'un jour)** — top 5 :
- Classement : 100, 80, 65, 50, 40

### Design

Transformer la section en un système d'onglets (Tabs) avec 3 catégories : **Grand Tour**, **2.Pro**, **1.1**. Chaque onglet affiche ses propres données dans le même layout de cartes existant. La catégorie 1.1 étant une course d'un jour, elle n'aura que la carte "Classement" (pas d'étapes ni de maillots).

Cela permet de visualiser immédiatement la différence d'échelle entre les catégories UCI.

### Changements

**`src/components/landing/BaremePreviewSection.tsx`** :
- Ajouter un état `activeTab` avec 3 options (GT / 2.Pro / 1.1)
- Créer les données pour chaque catégorie
- Afficher des boutons de sélection (pills/tabs) au-dessus de la grille
- Adapter le nombre de cartes selon la catégorie (3 cartes pour GT/