## Objectif

Améliorer la barre d'onglets de la page Enchères en mobile (`AuctionPageMobile.tsx`) : remplacer le scroll horizontal peu intuitif par une disposition en grille 2 lignes.

## Changement

Fichier : `src/components/auction/v2/AuctionPageMobile.tsx` (lignes 652-675)

- Supprimer le wrapper `overflow-x-auto scrollbar-hide` et le `inline-flex w-auto min-w-full` du `TabsList`.
- Utiliser une `TabsList` en `grid` avec `grid-cols-3`, `h-auto`, `gap-1`, `p-1`, ce qui placera naturellement les onglets sur 2 lignes (3 sur la première, 2 sur la seconde quand Historique + Annonces sont visibles ; sinon 3 sur une seule ligne).
- Chaque `TabsTrigger` garde le texte court (emoji + label) avec `text-xs`, retire `shrink-0 whitespace-nowrap` et ajoute `whitespace-nowrap` uniquement si nécessaire pour éviter le wrap intra-bouton ; ajouter `w-full` pour remplir sa cellule de grille.
- Garder le compteur sur l'onglet Enchères.

Aucune autre logique modifiée. Pas de changement desktop.
