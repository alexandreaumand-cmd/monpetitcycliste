

## Plan : Rendre l'indicateur rose plus visible sur mobile

### Problème

Le pictogramme rose existe déjà sur le bouton "Annonces" (point animé `h-2.5 w-2.5` positionné en haut à droite du bouton). Sur mobile, le bouton n'affiche que l'icône Megaphone (le texte "Annonces" est masqué via `hidden sm:inline`), ce qui rend le point très petit et difficile à repérer.

### Solution

**Fichier impacté** : `src/components/dashboard/LeagueCard.tsx`

1. **Agrandir le point rose sur mobile** : passer de `h-2.5 w-2.5` à `h-3.5 w-3.5` pour une meilleure visibilité tactile
2. **Ajouter un léger halo/glow rose** au bouton Annonces quand les annonces sont en cours, pour attirer l'œil même sans lire le point
3. **Afficher le texte "Annonces" aussi sur mobile** quand `isAnnouncementsPending` est true, pour que le bouton soit plus explicite dans ce cas précis

Concrètement :
- Le bouton reçoit une classe conditionnelle `border-[#E8A0B4] ring-2 ring-[#E8A0B4]/30` quand les annonces sont en attente
- Le `<span>` du texte "Annonces" perd son `hidden sm:inline` quand `isAnnouncementsPending` est true
- Le point passe à `h-3.5 w-3.5` pour être plus visible

