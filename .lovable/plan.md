

## Plan : Capturer les screenshots en mode light + desktop pour les enchères

### Modifications par rapport au plan précédent

1. **Passer l'app en mode light** avant de capturer les screenshots (le user est actuellement en dark mode)
2. **Page enchères** : screenshot en **desktop** (largeur ~1280px) au lieu de mobile — plus percutant pour montrer l'interface complète des enchères
3. **Pages équipe et classement** : screenshots en **mobile** (390px) comme prévu — adapté au mockup iPhone

### Étapes

1. Via le browser tool : basculer l'app en mode light (toggle theme)
2. Capturer la **page enchères en desktop** (1280px) → `public/screenshots/auction-desktop.png`
3. Capturer la **page équipe en mobile** (390px, light) → `public/screenshots/team.png`
4. Capturer le **classement en mobile** (390px, light) → `public/screenshots/ranking.png`
5. Mettre à jour `HowItWorksSection.tsx` :
   - Enchères : utiliser l'image desktop dans un **mockup navigateur** (cadre macOS avec coins arrondis + shadow) au lieu du PhoneMockup
   - Équipe et classement : garder le PhoneMockup avec les vraies images light
   - Supprimer les composants CSS mockup (`AuctionMockup`, `TeamMockup`, `RankingMockup`)

### Fichiers impactés
- `public/screenshots/auction-desktop.png` (nouveau)
- `public/screenshots/team.png` (nouveau)
- `public/screenshots/ranking.png` (nouveau)
- `src/components/landing/HowItWorksSection.tsx` — images réelles + mockup navigateur pour enchères

