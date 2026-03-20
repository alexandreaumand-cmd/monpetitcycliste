

## Plan : Déplacer le bloc texte à droite + Header vert avec logo horizontal

### 1. HeroSection.tsx — Bloc texte à droite

Déplacer le conteneur gradient+texte de gauche (`ml-5 md:ml-12`) vers la droite :
- Changer `flex items-end` → `flex items-end justify-end`
- Remplacer `ml-5 md:ml-12` par `mr-5 md:mr-12`
- Changer `rounded-r-2xl` → `rounded-l-2xl`
- Inverser le gradient : `bg-gradient-to-r from-black/75 via-black/60 to-transparent` → `bg-gradient-to-l from-black/75 via-black/60 to-transparent`
- **Aucune modification** du contenu interne (textes, animations, bouton, styles de typo)

### 2. LandingHeader.tsx — Fond vert + logo horizontal

- Remplacer `bg-transparent` par `bg-[#1B5E3B]` (vert marque)
- Remplacer le logo carré (`logo-carre-rose.png`) par le logo horizontal `logo-bordure-light.png` (texte rose sur fond sombre, adapté au fond vert)
- Augmenter légèrement la hauteur du logo (`h-9 w-9` → `h-8 w-auto`) pour un rendu horizontal
- Supprimer le `<span>` "La Bordure" textuel (le logo horizontal inclut déjà le nom)
- Garder le bouton connexion, adapter ses couleurs pour le fond vert (blanc/or)

### Fichiers impactés
- `src/components/landing/HeroSection.tsx` — positionnement droite
- `src/components/landing/LandingHeader.tsx` — fond vert + logo horizontal

