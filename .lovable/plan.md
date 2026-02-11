

# Hero Immersive - Generation d'image POV + Refonte

## Etape 1 : Generer l'image POV peloton via l'IA

Utiliser une edge function temporaire pour appeler le modele `google/gemini-3-pro-image-preview` (meilleure qualite image) avec un prompt detaille :

**Prompt prevu :**
> "Ultra-realistic first-person POV photograph from inside a professional cycling peloton. Camera is at handlebar height. We see the curved drop handlebars and brake hoods in the bottom foreground, slightly out of focus. Ahead, a dense pack of 30+ professional cyclists in colorful team jerseys fills the road. Motion blur on the edges conveys extreme speed. The road is smooth asphalt with white lane markings. Dramatic lighting, golden hour sun from the side. Shallow depth of field. Shot with a GoPro-style wide angle lens. Photorealistic, 8K quality."

L'image generee sera sauvegardee dans le storage Lovable Cloud (bucket `assets`), puis utilisee comme nouvelle image hero a la place de `hero-cycling.jpg`.

## Etape 2 : Creer l'edge function de generation

| Fichier | Action |
|---|---|
| `supabase/functions/generate-hero-image/index.ts` | Creer - appelle Lovable AI avec le modele image, upload le resultat dans le storage |

L'edge function :
1. Appelle `https://ai.gateway.lovable.dev/v1/chat/completions` avec `model: "google/gemini-3-pro-image-preview"` et `modalities: ["image", "text"]`
2. Recupere le base64 de l'image generee
3. Upload dans le bucket storage `assets` sous le nom `hero-peloton-pov.png`
4. Retourne l'URL publique

## Etape 3 : Refonte du HeroSection avec Framer Motion

| Fichier | Action |
|---|---|
| `package.json` | Ajout de `framer-motion` |
| `src/components/landing/HeroSection.tsx` | Refonte complete |

### Contenu du nouveau HeroSection

**Background Layer (motion.div)** :
- Image POV generee en fond
- Animation d'entree : scale 1.3 vers 1.0, blur 8px vers 0, duree 2s
- Tilt interactif au curseur (rotateY +/-3deg, desktop uniquement)
- Overlay gradient conserve (from-black/70 via-black/50 to-black)

**Speed Lines (CSS)** :
- Deux bandes verticales semi-transparentes sur les bords gauche et droit
- Animation CSS `translateY` en boucle pour simuler le defilement
- Flou directionnel via `blur` CSS

**Textes (motion.h1, motion.p)** :
- Titre 1 : entree depuis la gauche avec blur horizontal (filter: blur(10px) vers 0)
- Titre 2 : entree depuis la droite avec blur horizontal, delai 0.3s
- Sous-titre : fade-in classique, delai 0.6s
- CTAs : scale-in depuis 0.9, delai 0.8s

**CTA Pulse** :
- Keyframe CSS `pulse-energy` : box-shadow jaune (#FFD500) oscillant
- Applique uniquement sur le bouton principal

**Transition bas de section** :
- Gradient mask vers noir (couleur background) deja partiellement present, renforce pour une transition fluide

### Structure du composant

```text
section (relative, min-h-screen, overflow-hidden, perspective: 1000px)
  |
  +-- motion.div [Background] (scale/blur anim + tilt mouse)
  |     +-- img (nouvelle image POV)
  |     +-- div overlay gradient
  |
  +-- div [Speed Lines gauche] (CSS animation loop)
  +-- div [Speed Lines droite] (CSS animation loop)
  |
  +-- div [Content z-10]
  |     +-- motion.h1 titre1 (slide-left + blur)
  |     +-- motion.h1 titre2 (slide-right + blur)
  |     +-- motion.p subtitle (fade-in)
  |     +-- motion.div CTAs (scale-in)
  |           +-- Button primary (classe pulse-energy)
  |           +-- Button outline
  |
  +-- div [Gradient mask bottom]
  +-- button [Scroll indicator bounce]
```

## Etape 4 : Animations CSS dans index.css

Ajout des keyframes suivants :

- `pulse-energy` : ombre jaune oscillante (0% shadow 0px, 50% shadow 20px, 100% shadow 0px)
- `speed-line-left` / `speed-line-right` : translateY de 100% a -100% en boucle

## Etape 5 : Workflow d'execution

1. Installer `framer-motion`
2. Creer le bucket storage `assets` si inexistant
3. Creer et deployer l'edge function `generate-hero-image`
4. Appeler la function pour generer l'image
5. Mettre a jour `HeroSection.tsx` pour utiliser la nouvelle image + animations
6. Supprimer l'edge function temporaire (nettoyage)

## Performance

- `will-change: transform` sur le background layer
- `transform: translateZ(0)` pour GPU
- Animations CSS pures pour les boucles (speed lines, pulse)
- Framer Motion uniquement pour les entrees et le tilt
- Tilt desactive sur mobile via le hook `useIsMobile` existant

