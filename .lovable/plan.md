

## Ajouter des touches discrètes de rose (bordure-pink) sur la landing page

Actuellement la palette de la landing utilise principalement le vert (#1B5E3B) et l'or (#C8963A), mais le rose (#E8A0B4) — couleur tertiaire de La Bordure — est quasi absent. L'idée est d'ajouter des accents subtils sans surcharger.

### Emplacements proposés

1. **Icônes des step lists (HowItWorksSection)** — Alterner la couleur d'un ou deux icônes par bloc en rose au lieu de tout en or. Par exemple, le 2e et 4e icône de chaque bloc auront un fond `bg-bordure-pink/10` et une couleur `text-bordure-pink` au lieu de gold. Cela crée un rythme visuel discret.

2. **Surtitres de section** — Le surtexte "Découvre le jeu" est actuellement en or. On ajoute un petit trait décoratif rose (un `<span>` de 24px × 2px en `bg-bordure-pink`) avant ou après ce texte.

3. **Quote marks (SocialProofSection)** — Les icônes guillemets des citations sont actuellement en or/blanc. Les passer en `text-bordure-pink` pour une touche de couleur sur le fond vert.

4. **Barre décorative sous le titre Hero** — Ajouter une fine ligne (type `BordureStripes` horizontal) sous le sous-titre du hero, qui intègre naturellement le rose via les 4 couleurs de la marque.

5. **Footer — lien hover** — Ajouter un état hover rose (`hover:text-bordure-pink`) sur un des groupes de liens du footer, en alternance avec le gold existant.

### Fichiers impactés

- `src/components/landing/HowItWorksSection.tsx` — alternance couleur icônes
- `src/components/landing/SocialProofSection.tsx` — quote icons en rose
- `src/components/landing/HeroSection.tsx` — barre BordureStripes décorative
- `src/components/landing/LandingFooter.tsx` — hover rose sur un groupe de liens

Modifications légères, aucune nouvelle dépendance. Le rose reste à ~7% de présence visuelle conformément à la charte.

