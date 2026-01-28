
# Implémenter la Landing Page publique

## Objectif
Afficher une page d'accueil marketing pour les visiteurs non connectés sur `https://monpetitcycliste.lovable.app/` au lieu de les rediriger vers `/auth`.

---

## Ce qui existe deja

| Element | Statut |
|---------|--------|
| Traductions `home.json` (FR/EN) | Completes (hero, howItWorks, leagues, scoring, testimonials, whyPlay, cta, footer) |
| Assets images | `hero-cycling.jpg`, `cyclist-climbing.jpg`, `team-victory.jpg`, `mpc-logo.png` |
| Design system TdF | Jaune #FFD500 + noir, gradients, utilitaires CSS |

---

## Fichiers a creer

### 1. `src/pages/LandingPage.tsx`
Page principale assemblant toutes les sections :
- Header avec logo + bouton Connexion
- Hero avec image de fond et accroche
- Section "Comment ca marche" (3 etapes)
- Section types de ligues (4 cards)
- Section scoring (podium visuel)
- Section "Pourquoi jouer" (4 features)
- Section temoignages (3 citations)
- CTA final
- Footer

### 2. Composants modulaires dans `src/components/landing/`
- `LandingHeader.tsx` - Logo + navigation
- `HeroSection.tsx` - Accroche + image + CTA
- `HowItWorksSection.tsx` - 3 etapes illustrees
- `LeagueTypesSection.tsx` - 4 types de ligues
- `ScoringSection.tsx` - Tableau de points avec podium
- `WhyPlaySection.tsx` - 4 features
- `TestimonialsSection.tsx` - 3 citations
- `CTASection.tsx` - Appel a l'action final
- `LandingFooter.tsx` - Liens et copyright

---

## Fichier a modifier

### `src/pages/Index.tsx`
Changer la logique de redirection :

```text
AVANT:
- Connecte → /dashboard/home
- Non connecte → /auth (redirection)

APRES:
- Connecte → /dashboard/home (redirection)
- Non connecte → Afficher LandingPage (pas de redirection)
```

```typescript
// Nouvelle logique
if (isLoading) {
  return <SplashScreen />;
}

// Afficher la landing pour les visiteurs
if (!isAuthenticated) {
  return <LandingPage />;
}

// Les utilisateurs connectes sont rediriges par useEffect
return null;
```

---

## Design des sections

### Hero Section
```text
┌─────────────────────────────────────────────────┐
│                                                 │
│  [Logo MPC]                      [Connexion]    │
│                                                 │
│        "Les cols c'est pour eux,               │
│         les points, c'est pour toi."           │
│                                                 │
│        [Creer ma ligue]  [Decouvrir le jeu]    │
│                                                 │
│  (Image hero-cycling.jpg en fond avec overlay) │
└─────────────────────────────────────────────────┘
```

### Comment ca marche
```text
   ①                    ②                    ③
[Icone]             [Icone]             [Icone]
Cree ta ligue    Compose ton equipe   Suis les courses
```

### Scoring (Podium visuel)
```text
          🥇 100pts
      🥈 70pts   🥉 50pts
      
Stage: 1er=100, 2e=70, 3e=50, Top10=20
Maillots: Jaune=50, Vert=30, Pois=30
```

---

## Responsive

| Breakpoint | Comportement |
|------------|--------------|
| Mobile (<768px) | Stack vertical, CTA pleine largeur |
| Tablet | 2 colonnes pour cards |
| Desktop | 3-4 colonnes, sections plus aerees |

---

## Style et UX
- Fond noir avec accents jaunes (#FFD500)
- Animations au scroll (fade-in)
- Boutons avec hover effects (shadow, scale)
- Images avec overlays sombres pour lisibilite du texte
- Utilisation des classes existantes : `btn-tdf`, `card-tdf-hover`, `gradient-hero`
