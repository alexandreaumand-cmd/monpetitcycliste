

## Amélioration de la landing page — Modes de jeu et barèmes

### Constat

La landing page (`LandingPage.tsx`) n'utilise pas les composants `LeagueTypesSection` et `ScoringSection` qui existent déjà mais ne sont pas intégrés. De plus, `LeagueTypesSection` affiche des modes obsolètes (Sprint/Grand Tour/Season) au lieu des vrais modes du jeu (5 Phases / À la course). Il n'y a aucun exemple de barème de points.

### Plan

**1. Refondre `LeagueTypesSection.tsx`** — Remplacer les 3 modes fictifs par les 2 vrais modes de jeu :
- **Mode 5 Phases** : budget 2200, 30 coureurs, enchères par phase, variante WT
- **Mode À la course** : budget dynamique (650/800/1100), 8/10/15 coureurs, enchère unique
- Design en 2 colonnes avec les specs clés (budget, effectif, enchères)
- Reprendre le style épuré de la page Rules (cartes crème avec bordure dorée/pink)

**2. Créer un nouveau composant `BaremePreviewSection.tsx`** — Exemple de barème GT :
- Titre "Comment ça marque ?" avec sous-titre
- Un bloc visuel montrant le barème Grand Tour en exemple :
  - **Classement général** : top 5 (1600, 1280, 1040, 800, 600)
  - **Étape** : top 5 (300, 240, 195, 150, 120)
  - **Maillots** : Leader 20pts/j, Vert/GPM 12pts/j, Jeune 6pts/j
- Fond vert foncé (comme ScoringSection) pour contraster avec le reste
- Lien "Voir tous les barèmes" vers `/rules`

**3. Intégrer dans `LandingPage.tsx`** — Ajouter les 2 sections après `HowItWorksSection` :
```
HeroSection
GameOverviewSection
HowItWorksSection
→ LeagueTypesSection (modes de jeu)
→ BaremePreviewSection (exemple GT)
AuctionShowcase
SocialProofSection
...
```

**4. Traductions** — Ajouter les clés FR/EN dans `home.json` pour les 2 nouvelles sections (titres, descriptions des modes, labels barème).

### Fichiers impactés
- `src/components/landing/LeagueTypesSection.tsx` — refonte complète
- `src/components/landing/BaremePreviewSection.tsx` — nouveau
- `src/pages/LandingPage.tsx` — ajout des 2 sections
- `src/i18n/locales/fr/home.json` — nouvelles clés
- `src/i18n/locales/en/home.json` — nouvelles clés

