

## Plan : Créer 3 visuels publicitaires pour X — Lancement de La Bordure

### Format cible
- **Dimensions** : 1200×675px (ratio 16:9, optimal pour les posts X)
- **Format** : PNG haute qualité
- **Sortie** : `/mnt/documents/`

### Palette de la marque (identité La Bordure)
- Cream #F6F3ED, Green #1B5E3B, Gold #C8963A, Rose #E8A0B4, Text Green #2D3D32

### Les 3 visuels

**Visuel 1 — "L'annonce"** : Le logo La Bordure centré sur fond vert profond (#1B5E3B), avec le texte "La Bordure est enfin là" en typographie élégante crème/gold, et des accents roses. Sobre, solennel, impactant. Utilise `logo-bordure-light.png` (texte rose sur fond sombre).

**Visuel 2 — "Le concept"** : Split-screen avec l'image peloton aérien à gauche et une description à droite sur fond crème — "Fantasy cycling. Enchères en direct. Stratégie." avec le logo en bas. Met en avant le gameplay.

**Visuel 3 — "L'appel"** : Image hero handlebar en arrière-plan avec overlay vert semi-transparent, texte "Rejoins la course" en grand + URL du site + logo. Call-to-action fort.

### Approche technique
1. Copier le script AI image generation vers `/tmp/`
2. Utiliser les assets existants du projet (logo, images hero) comme base
3. Générer les 3 visuels via un script Python utilisant Pillow pour le compositing (logos, textes, overlays sur les photos existantes)
4. Sortie dans `/mnt/documents/`

### Fichiers impactés
- Aucun fichier du projet modifié
- 3 fichiers PNG générés dans `/mnt/documents/`

