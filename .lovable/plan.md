

## Plan : Gradient localisé uniquement derrière le bloc texte

### Approche

Remplacer le bandeau plein écran `bg-black/80` par un conteneur texte avec un gradient localisé — le fond sombre ne couvre que la zone du texte (en bas à gauche), pas toute la largeur.

### Détail technique

- Supprimer le `w-full bg-black/80 backdrop-blur-sm` du conteneur
- Envelopper le bloc texte dans un div avec `inline-block` ou `max-w-fit` + `bg-gradient-to-r from-black/75 via-black/60 to-transparent` + `backdrop-blur-[2px]` + `rounded-r-2xl` + padding généreux
- Le gradient s'estompe vers la droite, laissant la photo visible sur tout le côté droit
- Ajouter aussi un léger text-shadow sur les titres pour renforcer la lisibilité

```text
┌─────────────────────────────────────┐
│              PHOTO 100% VISIBLE     │
│                                     │
│                                     │
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▒▒▒░░              │
│ ▓ Fantasy Cycling    ▒░             │
│ ▓ Le cyclisme comme  ▒░             │
│ ▓ tu ne l'as jamais  ▒░             │
│ ▓ vécu               ▒░             │
│ ▓ [Créer ma ligue]   ▒░             │
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▒▒▒░░              │
└─────────────────────────────────────┘
  ▓ = noir/75%  ▒ = fondu  ░ = transparent
```

### Fichier impacté
- `src/components/landing/HeroSection.tsx`

