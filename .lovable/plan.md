

## Générer une illustration pour "Le Codeur"

### Approche

Utiliser le modèle d'édition d'image (google/gemini-3.1-flash-image-preview) pour transformer la photo en illustration stylisée, cohérente avec la DA du site La Bordure : tons verts (#1B5E3B), or (#C8963A), crème (#F6F3ED), style épuré et premium.

### Étapes

1. **Copier le script AI** (`lovable_ai.py`) dans `/tmp/`
2. **Générer l'illustration** via `--edit-image` avec un prompt décrivant le style souhaité : illustration minimaliste, trait fin, palette La Bordure (vert foncé, or, crème), style portrait éditorial
3. **QA visuelle** : vérifier le résultat
4. **Copier l'image** dans `src/assets/team/` du projet
5. **Mettre à jour `TeamPage.tsx`** : ajouter un champ `avatar` optionnel au type `TeamMember`, afficher l'image à la place de l'icône pour Le Codeur

### Fichiers impactés

- `src/assets/team/le-codeur.png` — nouvelle illustration générée
- `src/pages/TeamPage.tsx` — ajout du support avatar image pour les membres qui en ont un

### Style de l'illustration

Portrait stylisé, lignes épurées, fond crème/transparent, palette restreinte (vert bordure + or), aspect éditorial haut de gamme — pas cartoon, pas réaliste non plus. Un entre-deux sophistiqué type illustration magazine.

