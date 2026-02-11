

# Refonte totale Hero Section - Effet cinematographique "Plongee dans le peloton"

## Concept

L'effet repose sur une **sequence en 3 phases** :
1. **Phase 1 (0-2s)** : Vue aerienne du peloton - l'image est tres zoomee out (scale 0.6), avec un overlay sombre. Sensation de hauteur.
2. **Phase 2 (2-4s)** : Plongee cinematographique - zoom rapide (scale 0.6 vers 1.15) avec reduction du flou, comme si la camera descendait dans le peloton.
3. **Phase 3 (4s+)** : Stabilisation POV - le guidon (PNG transparent en premier plan) apparait en fade-in depuis le bas, ancrant l'utilisateur "sur le velo". Le peloton continue un lent mouvement de parallaxe vers l'avant.

Les textes n'apparaissent qu'apres la stabilisation (delai ~3.5s), avec un zoom-in subtil.

## Assets a generer (2 images IA)

### Image 1 : Peloton vu de dessus/arriere (fond principal)
**Prompt** : "Aerial rear view photograph of a dense professional cycling peloton of 40+ riders on a mountain road, shot from slightly behind and above, riders in colorful team jerseys, motion blur on the road surface, dramatic mountain landscape, golden hour lighting, cinematic wide angle, photorealistic"

### Image 2 : Guidon drop bar PNG transparent (premier plan)
**Prompt** : "Top-down view of professional road cycling drop handlebars with brake hoods and hands in cycling gloves gripping the bars, shot from rider's perspective looking down, isolated on pure black background, photorealistic, high detail on bar tape and shifters"

L'image du guidon sera ensuite traitee : le fond noir servira naturellement de transparence via `mix-blend-mode: screen` (le noir devient transparent).

## Architecture du composant

```text
section (relative, min-h-screen, overflow-hidden)
  |
  +-- motion.div [Phase 1-2 : Background Peloton]
  |     +-- img peloton (scale animee 0.6 -> 1.15)
  |     +-- div radial gradient overlay (bords sombres, centre clair)
  |     +-- div radial blur edges (flou sur les bords = vitesse)
  |
  +-- motion.div [Phase 3 : Guidon premier plan] (z-20)
  |     +-- img guidon PNG (mix-blend-mode: screen)
  |     +-- Fixe en bas de l'ecran, fade-in + slide-up depuis le bas
  |
  +-- div [Speed Lines gauche/droite] (z-15, existant)
  |
  +-- motion.div [Contenu texte] (z-30, apparait apres phase 3)
  |     +-- motion.h1 titre1 (zoom-in + fade, delay 3.5s)
  |     +-- motion.h1 titre2 jaune (zoom-in + fade, delay 3.8s)
  |     +-- motion.p subtitle (fade-in, delay 4.1s)
  |     +-- motion.div CTAs (scale-in, delay 4.4s)
  |
  +-- div [Gradient mask bottom] (z-25)
  +-- button [Scroll indicator] (z-30)
```

## Animations detaillees

### Background Peloton (Framer Motion)
- **Keyframes** : `scale` de 0.6 a 1.15 sur 3.5s avec ease `[0.25, 0.1, 0.25, 1]`
- **Filter** : `blur(4px)` vers `blur(0px)` en parallele
- **Apres stabilisation** : mouvement lent continu `scale` de 1.15 a 1.2 sur 20s en boucle (parallaxe subtile, le peloton "avance")
- **Tilt souris** : Conserve sur desktop, rotateY/rotateX +/-3deg

### Radial Blur (CSS)
- Gradient radial : centre transparent, bords avec `backdrop-filter: blur(6px)` via un pseudo-element
- Simule un flou de vitesse peripherique sans toucher au texte central

### Guidon (Framer Motion)
- Apparait a t=2.5s
- Animation : `y: 100px` vers `y: 0`, `opacity: 0` vers `1`, duree 1s
- Positionne en `fixed bottom`, occupe ~25% du bas de l'ecran
- `mix-blend-mode: screen` pour que le fond noir devienne transparent
- Reste fixe (pas de tilt) = ancrage visuel

### Textes (Framer Motion)
- Tous avec `scale: 0.85` vers `1`, `opacity: 0` vers `1`
- Delais staggers : 3.5s, 3.8s, 4.1s, 4.4s
- Pas de slide lateral cette fois, uniquement zoom-in pour renforcer l'effet "on est arrive"

### CTA Pulse
- Inchange (keyframe `pulse-energy` existant)

## Fichiers modifies

| Fichier | Action |
|---|---|
| `src/assets/hero-peloton-aerial.jpg` | Nouveau - image IA peloton aerien |
| `src/assets/hero-handlebar.jpg` | Nouveau - image IA guidon drop bar |
| `src/components/landing/HeroSection.tsx` | Refonte complete |
| `src/index.css` | Ajout keyframe `peloton-drift` (mouvement lent continu) |

## Optimisations performance

- `will-change: transform` sur le background uniquement pendant l'animation d'entree
- Guidon : image legere (le fond noir + blend mode evite de gerer un vrai PNG transparent lourd)
- Speed lines : animations CSS pures (inchangees)
- Tilt souris : desactive sur mobile
- Le guidon est masque sur mobile (trop petit pour etre lisible, on garde uniquement le zoom cinematographique)

## Timing complet de la sequence

| Temps | Evenement |
|---|---|
| 0s | Image peloton visible, scale 0.6, blur 4px, overlay sombre |
| 0-3.5s | Zoom progressif scale 0.6 vers 1.15, blur disparait |
| 2.5s | Guidon apparait en slide-up depuis le bas |
| 3.5s | Titre 1 apparait (zoom-in) |
| 3.8s | Titre 2 jaune apparait |
| 4.1s | Sous-titre apparait |
| 4.4s | CTAs apparaissent |
| 4s+ | Peloton continue un lent drift scale 1.15 vers 1.2 (boucle 20s) |

