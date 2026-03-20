

## Bloc synthétique "Comment ça marche" entre le Hero et les blocs détaillés

Un bandeau horizontal avec 4 icônes en ligne, résumant le jeu en 4 mots-clés. Fond cream, style épuré, centré.

### Contenu

```text
  🔨 Enchéris        🚴 Suis          📊 Marque         👑 Domine
  Recrute tes        Suis les         Tes coureurs      Grimpe au
  coureurs aux       courses UCI      marquent à        classement et
  enchères           en direct        chaque arrivée    chambre tes potes
```

- **Enchéris** — icône Gavel — "Recrute tes coureurs aux enchères entre amis."
- **Suis** — icône Radio/Activity — "Suis les courses UCI tout au long de la saison."
- **Marque** — icône TrendingUp — "Tes coureurs marquent des points à chaque course."
- **Domine** — icône Crown — "Grimpe au classement et chambre tes potes."

Grille 2×2 sur mobile, 4 colonnes sur desktop. Chaque item : icône dans un cercle (alternance gold/pink selon la charte 10%/7%), titre bold en vert, description courte. Animation fade-in au scroll.

### Fichiers impactés

- **`src/components/landing/GameOverviewSection.tsx`** (nouveau) — Le composant avec la grille d'icônes
- **`src/components/landing/index.ts`** — Export ajouté
- **`src/pages/LandingPage.tsx`** — Inséré entre `<HeroSection />` et `<HowItWorksSection />`
- **`src/i18n/locales/fr/home.json`** et **`en/home.json`** — Clés `overview.steps` avec titre + description FR/EN

