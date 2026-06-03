## Objectif

Dans `FiltersDrawer.tsx` (drawer mobile des enchères), rendre les sections **Côtes**, **Catégories** et **Équipes** repliables pour alléger l'affichage et accéder plus facilement à la section **Courses** située en bas.

## Changements

Fichier unique : `src/components/auction/v2/FiltersDrawer.tsx`

1. Ajouter un état local `collapsed` (objet `{ cotes, categories, teams, courses }`) avec valeurs par défaut :
   - `cotes`, `categories`, `teams` : repliés par défaut si aucun filtre actif dans la section ; dépliés si la section a des sélections actives (pour rester visible quand l'utilisateur a déjà filtré).
   - `courses` : déplié par défaut (c'est ce que l'utilisateur veut atteindre).

2. Transformer le label de chaque section en bouton cliquable (toute la ligne titre) :
   - Ajout d'un chevron (`ChevronDown` / `ChevronRight` depuis lucide-react) à gauche ou droite du titre.
   - Le compteur de sélection `(N)` reste visible même replié, pour qu'on voie d'un coup d'œil qu'un filtre est actif.
   - Les boutons d'action (Tout / Aucun) restent dans l'en-tête mais ne déclenchent pas le toggle (stop propagation).

3. Conditionner l'affichage du contenu de chaque section (badges côtes, badges catégories, input + liste équipes) sur l'état `collapsed`. Garder la section Courses telle quelle (ou aussi rendre repliable avec valeur par défaut "déplié" pour cohérence visuelle).

4. Le bouton "Tout effacer" en haut et le bouton "Filtrer" en bas restent inchangés.

## Détails techniques

- Pas d'animation lourde, simple show/hide conditionnel pour rester léger.
- Aucune modification de la logique de filtrage ni des props.
- Aucun changement côté desktop (composant mobile uniquement).
