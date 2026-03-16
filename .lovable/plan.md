

## Plan : Logos avec nom de marque sur mobile

Deux changements simples — remplacer les icônes carrées par les logos horizontaux avec texte "La Bordure".

### 1. `DashboardHomeHeader.tsx` — Header Home mobile (fond vert)

Remplacer `logo-carre-rose.png` (icône 48x48) par `logo-bordure-light.png` (logo horizontal clair). Ajuster la taille à `h-10 w-auto` pour un rendu proportionné dans le header.

### 2. `MobileLayout.tsx` — Header pages intérieures (fond beige)

Remplacer `logo-carre-rose.png` (icône 32x32) par `logo-bordure.png` (logo horizontal vert). Ajuster la taille à `h-7 w-auto`.

### Fichiers modifiés

| Fichier | Changement |
|---|---|
| `src/components/dashboard/DashboardHomeHeader.tsx` | Import + utilisation `logo-bordure-light.png` en mobile |
| `src/components/mobile/MobileLayout.tsx` | Import + utilisation `logo-bordure.png` |

