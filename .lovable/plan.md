

## Plan : Refonte Home Page — Style Éditorial Magazine (inspiration Rapha)

### Vision

Abandonner le template "SaaS standard" pour un design éditorial haut de gamme, inspiré de Rapha.cc : grandes photos de cyclisme réel plein écran, typographies expressives, mise en page asymétrique, et des screenshots réels de l'app intégrés dans des mockups device. Ton premium et passionné.

### Structure (5 sections, redesign complet)

```text
┌──────────────────────────────────────────┐
│ HEADER transparent (logo + CTA discret)  │
├──────────────────────────────────────────┤
│ 1. HERO ÉDITORIAL — Plein écran         │
│    Photo Unsplash peloton 100vh          │
│    Grande typo asymétrique à gauche      │
│    "Le cyclisme comme tu ne l'as         │
│     jamais vécu" — style magazine        │
│    CTA doré discret mais clair           │
├──────────────────────────────────────────┤
│ 2. DÉCOUVRE LE JEU — Screenshots app    │
│    3 screenshots (enchères, équipe,      │
│    classement) dans des mockups iPhone   │
│    Texte éditorial entre les visuels     │
│    Layout asymétrique : texte + device   │
│    Fond crème                            │
├──────────────────────────────────────────┤
│ 3. L'ENCHÈRE — Immersion                │
│    Photo cycliste gros plan + overlay    │
│    Simulation visuelle d'enchère live    │
│    Grande typo : "Qui recrutera          │
│    Pogačar ?" — narratif, pas descriptif │
├──────────────────────────────────────────┤
│ 4. ENTRE AMIS — Social proof            │
│    Photo de groupe/célébration           │
│    Stats en typo XXL sur la photo        │
│    Témoignages en superposition          │
├──────────────────────────────────────────┤
│ 5. CTA FINAL — Immersif                 │
│    Photo montagne/col plein écran        │
│    "Crée ta ligue" — typo géante        │
│    Bouton + bouton partage               │
├──────────────────────────────────────────┤
│ FOOTER (inchangé)                        │
└──────────────────────────────────────────┘
```

### Différences clés vs version actuelle

| Actuel | Nouveau |
|--------|---------|
| Layout centré symétrique | Layout asymétrique, textes alignés à gauche |
| Pas de photos de coureurs | 3-4 photos Unsplash libre de droits (peloton, sprint, portrait, col) |
| Pas de screenshots app | 3 screenshots dans des mockups iPhone |
| Fond vert uniforme | Alternance photo plein écran / fond crème |
| Typo standard h1/h2 | Typo XXL expressive (8xl+), italique pour les accroches |
| Badges icônes génériques | Storytelling éditorial, phrases courtes |

### Photos Unsplash (libres de droit)

Les images seront des URLs Unsplash directes :
- **Hero** : peloton en haute montagne ou sprint massif (vue large cinématique)
- **Section enchères** : portrait rapproché d'un cycliste en effort
- **Section social** : célébration d'équipe ou peloton vu de l'intérieur
- **CTA** : col de montagne dramatique

### Screenshots de l'app

Méthode : utiliser le browser tool pour naviguer vers les pages clés de l'app, prendre des screenshots, puis les intégrer dans un mockup iPhone via le product-shot generator ou directement en CSS (border-radius + shadow). Les 3 pages ciblées :
1. **Page d'enchères en direct** — le cœur du jeu
2. **Composition d'équipe** — montrer les coureurs recrutés
3. **Classement de la ligue** — la compétition entre amis

Les screenshots seront stockés dans `public/` et référencés dans les composants.

### Détails par section

**1. Hero Éditorial**
- Photo plein écran 100vh avec overlay gradient subtil (pas vert opaque comme actuellement — juste un léger assombrissement)
- Texte aligné à gauche en bas (pas centré)
- Titre en 2 lignes : grande typo blanche + une ligne en italique dorée
- Sous-titre court, une phrase
- CTA unique : bouton doré avec ombre

**2. Découvre le jeu (remplace "Comment ça marche")**
- Fond crème, layout en 3 blocs alternés (texte gauche + screenshot droite, puis inversé)
- Chaque bloc : un titre accrocheur + 1-2 phrases + screenshot dans un mockup device
- Pas de numérotation 1-2-3-4, style narratif
- Thèmes : "Recrute aux enchères", "Compose ton équipe", "Domine le classement"

**3. L'Enchère (refonte AuctionShowcase)**
- Photo cycliste en fond avec overlay sombre
- La simulation d'enchère actuelle (3 managers, bids) est conservée mais redesignée en carte flottante glass-morphism
- Grande typo à gauche : "Qui recrutera Pogačar ?" en italique
- CTA intégré

**4. Entre Amis (refonte SocialProof)**
- Photo de fond (peloton/célébration) avec overlay
- Stats en typo XXL semi-transparentes superposées sur la photo
- 2 témoignages en cards flottantes avec effet glass

**5. CTA Final**
- Photo col de montagne plein écran
- Typo géante "Prêt à lancer ta ligue ?"
- 2 boutons : créer + partager

### Fichiers impactés
- `src/components/landing/HeroSection.tsx` — refonte complète (layout asymétrique)
- `src/components/landing/HowItWorksSection.tsx` — renommé conceptuellement en "Découvre le jeu" avec screenshots
- `src/components/landing/AuctionShowcase.tsx` — redesign éditorial
- `src/components/landing/SocialProofSection.tsx` — redesign avec photo de fond
- `src/components/landing/CTASection.tsx` — redesign immersif
- `src/components/landing/LandingHeader.tsx` — header transparent
- `src/i18n/locales/fr/home.json` — nouveaux textes éditoriaux
- `src/i18n/locales/en/home.json` — idem EN
- `src/pages/LandingPage.tsx` — même structure, composants redesignés

### Étapes d'implémentation
1. Prendre les 3 screenshots de l'app (enchères, équipe, classement) via le browser tool
2. Mettre à jour les traductions FR/EN avec le nouveau ton éditorial
3. Refondre chaque composant section par section
4. Intégrer les photos Unsplash et les screenshots

