

## Plan : Capturer les vrais screenshots mobile de l'app

### Étapes

1. **Via le browser tool**, naviguer vers le preview de l'app (session partagée avec vous)
2. **Passer en mode light** si nécessaire (toggle theme)
3. **Capturer 3 screenshots mobile** (viewport 390x844) :
   - **Classement** (`/dashboard/classement`) → `public/screenshots/ranking.png`
   - **Équipe** (`/dashboard/equipe`) → `public/screenshots/team.png`
   - **Enchères** en desktop (1280px) → `public/screenshots/auction-desktop.png`
4. **Mettre à jour `HowItWorksSection.tsx`** :
   - Remplacer les composants CSS mockup (`AuctionMockup`, `TeamMockup`, `RankingMockup`) par les vraies images
   - Enchères : mockup navigateur (cadre macOS) avec image desktop
   - Équipe & classement : PhoneMockup avec images mobile
5. Supprimer les composants mockup CSS inutiles

### Fichiers impactés
- `public/screenshots/` — 3 nouvelles images
- `src/components/landing/HowItWorksSection.tsx` — images réelles

