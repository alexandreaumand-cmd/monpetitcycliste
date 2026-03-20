

## Ajouter une tagline centrée dans le header

Ajouter un texte discret "Le jeu pour les passionnés de vélo" au centre du header, entre le logo (gauche) et le bouton connexion (droite).

### Changements

**`src/components/landing/LandingHeader.tsx`** — Ajouter un `<span>` centré avec le texte en vert (#1B5E3B), petite taille (`text-xs`), font italic ou normal, `font-inter`. Masqué sur mobile (`hidden md:block`) pour ne pas surcharger.

**`src/i18n/locales/fr/home.json`** et **`src/i18n/locales/en/home.json`** — Ajouter une clé `header.tagline` : "Le jeu pour les passionnés de vélo" (FR) / "The game for cycling enthusiasts" (EN).

