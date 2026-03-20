
## Ajouter une section "Citations Presse" en bas de la page Équipe

### Contenu

**Society** — 12 octobre 2023
- "Un groupe d'amis rendus fous par le vélo théorisent sur d'obscures courses en Asie"
- "Régis patte de lapin discute avec les fous furieux"
- Sous-titre : Veille de l'adieu à Thibaut Pinot en Lombardie

**Pédale** — 18 juin 2025
- "Parce que la compétition est d'abord interne, tout est bon pour chambrer mais aussi intoxiquer son ami/adversaire avec des méthodes dignes de l'opération Fortitude pré-Débarquement. « Avant les enchères, on fait de faux articles Paint ou Photoshop pour faire croire que des coureurs sont tombés et se sont blessés… »"

### Design

Section séparée sous la grille des membres, avec un titre "Ils parlent de nous". Chaque citation presse dans une carte blanche avec :
- Logo du magazine (à fournir comme assets : `src/assets/press/society-logo.png` et `src/assets/press/pedale-logo.png`)
- Nom du magazine + date
- Les citations en italique avec guillemets français
- Contexte en texte plus discret

Style cohérent avec le reste : fond crème, cartes blanches, bordures fines, typo Montserrat/Inter, couleurs bordure-green/gold.

### Étapes

1. **Demander les logos** — Il faudra uploader les logos de Society et Pédale
2. **Ajouter la section presse** dans `TeamPage.tsx` après la grille des membres, avec les données en dur
3. **Animations** — Même pattern framer-motion que les cartes existantes

### Fichiers impactés

- `src/pages/TeamPage.tsx` — Ajout de la section citations presse
- `src/assets/press/society-logo.png` — Logo Society (à uploader)
- `src/assets/press/pedale-logo.png` — Logo Pédale (à uploader)

### Question préalable

J'aurai besoin que tu uploades les logos des magazines **Society** et **Pédale** pour les intégrer dans les cartes.
