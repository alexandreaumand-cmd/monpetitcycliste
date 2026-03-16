

# Plan : Rebrand complet "La Bordure Fantasy Cycling"

## Portée du changement

Le projet utilise actuellement une charte "Tour de France" (jaune #FFD500, noir, Poppins). Il faut migrer vers la charte "La Bordure" (vert #1E4D2B, or #C9922A, rose #E8A0B0, crème #F5F0E8).

**978 occurrences** de couleurs TdF (jaune, yellow-500, #FFD500, bg-black) réparties sur **68 fichiers**.

---

## Phase 1 — Design System (fondations)

### 1.1 `src/index.css` : Remplacer toutes les CSS variables

Palette HSL La Bordure :
- Vert principal `#1E4D2B` → `147 45% 21%`
- Or `#C9922A` → `38 66% 48%`
- Rose `#E8A0B0` → `346 52% 77%`
- Crème `#F5F0E8` → `38 38% 93%`

Variables `:root` :
- `--background` → crème `38 38% 93%`
- `--foreground` → vert `147 45% 21%`
- `--primary` → or `38 66% 48%`
- `--primary-foreground` → blanc `0 0% 100%`
- `--secondary` → vert `147 45% 21%`
- `--secondary-foreground` → blanc `0 0% 100%`
- `--accent` → rose pâle `346 52% 92%`
- `--accent-foreground` → vert
- `--muted` → crème foncé `38 25% 88%`
- `--card` → blanc `0 0% 100%`
- `--ring` → or
- `--border` → vert pâle `147 20% 80%`
- Nouveaux : `--bordure-green`, `--bordure-gold`, `--bordure-pink`, `--bordure-cream`
- Gradients : vert→or au lieu de noir→jaune
- Shadows : reflets or au lieu de jaune

Mode `.dark` :
- `--background` → vert très foncé `147 40% 8%`
- `--card` → vert foncé `147 35% 12%`
- `--primary` → or (conservé)
- `--secondary` → vert clair `147 30% 25%`
- Bordures et muted adaptés

Supprimer toutes les classes utilitaires `tdf-*`, `btn-tdf`, `card-tdf-hover`. Remplacer par `bordure-green-bg`, `bordure-gold-text`, `card-bordure-hover`, `btn-bordure`, `btn-bordure-inverse`.

Ajouter la classe utilitaire `.bordure-stripes` (bandes verticales décoratives : rose, or, blanc, vert).

Typographie : remplacer `font-poppins` par `font-inter` pour body, garder `font-montserrat` pour titres. Ajouter `uppercase` et `tracking-wider` aux h1/h2. Interlignage `leading-[1.3]` par défaut.

### 1.2 `tailwind.config.ts`

- Remplacer `font-poppins` par `font-inter` dans `fontFamily.sans`
- Supprimer la définition `poppins`
- Ajouter couleurs sémantiques Tailwind : `bordure-green`, `bordure-gold`, `bordure-pink`, `bordure-cream`

### 1.3 `index.html`

- Remplacer le chargement Google Fonts : supprimer Poppins, garder Montserrat + Inter (déjà chargé mais ajouter les poids Light 300)

---

## Phase 2 — Composants UI primitifs

### 2.1 `button.tsx`
- `default` : `bg-[#C9922A] text-white hover:bg-[#B8832A] font-montserrat font-bold uppercase`
- `secondary` : `bg-[#1E4D2B] text-white hover:bg-[#163D22] font-montserrat font-bold`
- `outline` : border vert, texte vert
- Supprimer toutes les refs à `#FFD500`, `yellow-*`, `font-poppins`

### 2.2 `badge.tsx`
- `default` : `bg-bordure-gold text-white font-montserrat`
- `secondary` : `bg-bordure-green text-white`

### 2.3 `card.tsx`
- Hover : `hover:border-[#C9922A]/50 hover:shadow-[#C9922A]/10` au lieu de yellow

### 2.4 `progress.tsx`, `tabs.tsx`, `sonner.tsx`
- Vérifient qu'ils utilisent les CSS vars (primary, secondary) — pas de hardcoded colors

---

## Phase 3 — Landing page (10 fichiers)

### 3.1 `LandingPage.tsx`
- Fond : `bg-[#1E4D2B]` au lieu de `bg-black`

### 3.2 `LandingHeader.tsx`
- Header : `bg-[#1E4D2B]/95` au lieu de `bg-black/90`
- Border : `border-[#C9922A]/30` au lieu de `border-yellow-500/20`

### 3.3 `HeroSection.tsx`
- Overlay gradients : noir→vert foncé au lieu de noir pur
- Titre accent : `text-[#C9922A]` au lieu de `text-[hsl(var(--tdf-yellow))]`
- Supprimer `font-poppins`, mettre `font-montserrat uppercase`
- Pulse energy : utilise `--primary` (maintenant or)

### 3.4 `HowItWorksSection.tsx`
- Fond : `bg-[#1E4D2B]`, icônes en or, progress line en or
- Step badges : `bg-[#C9922A]` au lieu de `bg-[#FFD500]`
- Cards border hover : `hover:border-[#C9922A]/50`

### 3.5 `LeagueTypesSection.tsx`
- Fond : `bg-[#F5F0E8]` (crème) au lieu de `bg-gray-950`
- Textes : vert foncé au lieu de blanc
- Featured badge : `bg-[#C9922A] text-white`
- Cards : fond blanc, border vert

### 3.6 `ScoringSection.tsx`
- Fond section : `bg-[#1E4D2B]`
- Card interface : fond vert foncé, accents or
- Position 1 badge : `bg-[#C9922A] text-white`

### 3.7 `TeamPreviewSection.tsx`
- Icônes et points : or `text-[#C9922A]` au lieu de `text-[#FFD500]`

### 3.8 `WhyPlaySection.tsx`
- Fond : `bg-[#1E4D2B]`
- Stats : `text-[#C9922A]` au lieu de `text-[#FFD500]`
- Check icons : or

### 3.9 `TestimonialsSection.tsx`
- Fond : crème, texte vert
- Featured card : gradient or au lieu de jaune
- Avatar gradient : or

### 3.10 `CTASection.tsx` + `LandingFooter.tsx`
- CTA : overlay vert foncé, shadow or
- Footer : `bg-[#1E4D2B]`, liens hover or, border or/30

---

## Phase 4 — Dashboard & Navigation (shell)

### 4.1 `DashboardHomeHeader.tsx`
- Header : `bg-[#1E4D2B]/95`, border `border-[#C9922A]/30`
- Icônes nav : `text-[#C9922A]` au lieu de `text-yellow-500`
- Titre : blanc (sur fond vert)

### 4.2 `MobileBottomBar.tsx`
- Nav : `bg-[#1E4D2B]/95`, border `border-[#C9922A]/30`
- Active state : `bg-[#C9922A] text-white` au lieu de `bg-[#FFD500] text-black`

### 4.3 `MobileLayout.tsx` + `MobileHeader.tsx`
- Header backgrounds : vert foncé au lieu de noir
- Borders : or au lieu de jaune

### 4.4 `MobileDrawer.tsx`
- Pas de changements majeurs (utilise les vars CSS)

### 4.5 `AppSidebar.tsx`
- Utilise déjà les CSS vars, pas de hardcoded — OK

---

## Phase 5 — Remplacement global

### 5.1 Search & replace dans les ~60 fichiers restants
Remplacements systématiques dans tous les fichiers `.tsx/.ts` :
- `#FFD500` → `#C9922A`
- `yellow-500` → `bordure-gold` (ou `[#C9922A]`)
- `yellow-400` → `[#C9922A]`
- `yellow-600` → `[#B8832A]`
- `bg-black` (fond section) → `bg-[#1E4D2B]`
- `bg-gray-950` → `bg-[#F5F0E8]` ou `bg-[#1E4D2B]` selon contexte
- `bg-gray-900` → adapté selon contexte
- `text-white` sur fond noir → `text-white` sur fond vert (OK)
- `font-poppins` → `font-inter` (sauf si titre → `font-montserrat`)
- `border-yellow-500/30` → `border-[#C9922A]/30`
- `shadow-yellow-500` → `shadow-[#C9922A]`
- `text-gray-400` → `text-muted-foreground` (cohérence via CSS vars)

### 5.2 Élément signature : bandes verticales décoratives
Créer un composant `BordureStripes.tsx` qui affiche 4 bandes verticales (rose, or, blanc, vert). L'intégrer dans :
- `LandingHeader` (côté gauche)
- `LandingFooter` (côté gauche)
- `DashboardHomeHeader` (accent)

### 5.3 `ui-constants.ts`
- Mettre à jour les hover states des cards

---

## Phase 6 — Titres en majuscules

Dans `src/index.css`, la règle `h1, h2, h3` reçoit `text-transform: uppercase; letter-spacing: 0.05em; line-height: 1.3`.

---

## Fichiers impactés (estimé)

| Catégorie | Fichiers | Effort |
|-----------|----------|--------|
| Design system (CSS/Tailwind) | 3 | Fort |
| UI primitifs (button, badge, card...) | 4 | Moyen |
| Landing page | 10 | Fort |
| Dashboard shell (headers, nav) | 5 | Moyen |
| Autres composants (search/replace) | ~50 | Moyen (systématique) |
| Nouveau composant BordureStripes | 1 | Léger |

**Total : ~70 fichiers modifiés, 1 créé**

---

## Risques et précautions

- Les images (hero-peloton, cyclist-climbing) restent compatibles avec la nouvelle palette
- Le logo `mpc-logo.png` n'est pas modifié (règle : ne jamais déformer/recolorer)
- Le dark mode doit être cohérent (vert foncé au lieu de noir)
- Les composants Shadcn qui utilisent les CSS vars (`primary`, `secondary`) se mettront à jour automatiquement via Phase 1

