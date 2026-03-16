

## Plan : Remplacer le logo dans le DashboardHomeHeader

### Constat
La capture d'écran montre le header du dashboard home (`DashboardHomeHeader.tsx`), qui utilise actuellement `mpcLogo` (logo carré) + texte "La Bordure". Il faut y mettre le nouveau logo horizontal light (pour fond vert/sombre).

### Modifications

**1. Copier le logo light uploadé** → `src/assets/logo-bordure-light.png`

**2. Modifier `src/components/dashboard/DashboardHomeHeader.tsx`** (version desktop, lignes 80-93) :
- Remplacer le combo `BordureStripes` + `mpcLogo` + `<h1>La Bordure</h1>` par une seule image `logo-bordure-light.png`
- Taille adaptée : `h-10 w-auto` pour s'intégrer dans le header

**3. Version mobile** (lignes 36-43) :
- Remplacer `mpcLogo` par le logo carré favicon (`logo-carré-sans-marque.png`) ou le logo light selon l'espace disponible

