

## Plan : Refonte de la Home Page — Style App Store

### Vision

Page épurée style "product page" avec 4-5 sections percutantes. L'objectif est clair : comprendre le jeu en 30 secondes et créer un compte. Visuels de cyclisme réel (Unsplash/Pexels), mise en avant des enchères entre amis, CTA omniprésent.

### Structure (5 sections)

```text
┌─────────────────────────────────────┐
│ HEADER (fixe, simplifié)            │
├─────────────────────────────────────┤
│ 1. HERO — Plein écran              │
│    Photo peloton + tagline          │
│    "Fantasy cycling entre amis"     │
│    Bouton CTA dominant              │
│    3 bullet points icônes           │
├─────────────────────────────────────┤
│ 2. COMMENT ÇA MARCHE               │
│    4 étapes visuelles horizontales  │
│    Focus sur les enchères           │
│    Mockup/screenshot du jeu         │
├─────────────────────────────────────┤
│ 3. LES ENCHÈRES ENTRE AMIS         │
│    Section dédiée avec animation    │
│    Simulation visuelle d'enchère    │
│    "Qui paiera le plus pour         │
│     Pogacar ?" — aspect compétitif  │
├─────────────────────────────────────┤
│ 4. SOCIAL PROOF                     │
│    Stats clés (courses, coureurs)   │
│    2-3 témoignages courts           │
├─────────────────────────────────────┤
│ 5. CTA FINAL                        │
│    Photo immersive + "Crée ta       │
│    ligue" + bouton partage          │
├─────────────────────────────────────┤
│ FOOTER (simplifié)                  │
└─────────────────────────────────────┘
```

### Sections supprimées
- **LeagueTypesSection** (Sprint/Grand Tour/Saison) — trop complexe pour la home, distrait du CTA
- **ScoringSection** — détail de scoring trop technique
- **TeamPreviewSection** — composition d'équipe, secondaire
- **WhyPlaySection** — fusionné avec Social Proof

### Détails par section

**1. Hero (refonte complète)**
- Photo plein écran depuis Unsplash (peloton en montagne ou sprint)
- Tagline : "Les cols c'est pour eux, les points c'est pour toi"
- Sous-titre court expliquant le concept
- **1 seul CTA** gros et visible : "Créer ma ligue"
- 3 mini-badges en dessous : "🚴 Vraies courses UCI" • "🏆 Enchères entre amis" • "📱 Gratuit"

**2. Comment ça marche (simplifié)**
- 4 étapes en ligne avec icônes + texte court
- Chaque étape a une micro-illustration/icône
- Fond crème (#F6F3ED)
- Bouton CTA secondaire en bas

**3. Les enchères entre amis (NOUVEAU — section clé)**
- Fond vert foncé (#1B5E3B)
- Simulation visuelle d'une enchère : 3 managers avec leurs mises sur un coureur
- Animation type "Who bids more?" avec compteur
- Photo de cycliste en arrière-plan (Unsplash)
- Texte : "Défie tes amis aux enchères pour recruter les meilleurs coureurs"
- Bouton "Inviter mes amis"

**4. Social Proof (fusion stats + témoignages)**
- Fond crème
- Ligne de stats animées (350+ courses, 1000+ coureurs)
- 2 témoignages courts en cards
- Compact, une seule section

**5. CTA Final**
- Photo immersive cyclist climbing (existante)
- Overlay vert
- "Rejoins la communauté" + CTA "Créer ma ligue"
- Bouton secondaire "Partager avec un ami" (copie le lien)

### Images Unsplash à intégrer
- Hero : peloton en montagne ou sprint massif
- Section enchères : portrait cycliste ou sprint serré
- Les images seront référencées via URL Unsplash (pas de téléchargement)

### Fichiers impactés
- `src/pages/LandingPage.tsx` — nouvelle structure de sections
- `src/components/landing/HeroSection.tsx` — refonte complète
- `src/components/landing/HowItWorksSection.tsx` — simplification
- `src/components/landing/AuctionShowcase.tsx` — **nouveau** (section enchères)
- `src/components/landing/SocialProofSection.tsx` — **nouveau** (fusion stats+témoignages)
- `src/components/landing/CTASection.tsx` — ajout bouton partage
- `src/components/landing/LandingHeader.tsx` — simplification
- `src/i18n/locales/fr/home.json` — nouvelles clés
- `src/i18n/locales/en/home.json` — nouvelles clés
- Suppression de `LeagueTypesSection`, `ScoringSection`, `TeamPreviewSection`, `WhyPlaySection`, `TestimonialsSection` de la page (fichiers conservés mais retirés du rendu)

### Principes UX
- Chaque section a un CTA visible (pas besoin de scroller pour trouver un bouton)
- Mobile-first : tout fonctionne en colonne sur petit écran
- Animations légères au scroll (fade-in), pas de délais longs comme le hero actuel (3.5s)
- Palette respectée : cream/green/gold/rose

