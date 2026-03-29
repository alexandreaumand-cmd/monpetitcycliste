

## Cartes de visite professionnelles La Bordure — PPTX

### Concept

10 slides PPTX, une carte par slide au format standard 85x55mm (ratio 1.545:1). Design élégant minimaliste reprenant la charte La Bordure.

### Layout de chaque carte

```text
┌─────────────────────────────────────────────────────┐
│  fond crème #F6F3ED                                 │
│                                                     │
│   ┌────┐                                            │
│   │logo│  LA BORDURE                                │
│   └────┘  Fantasy Cycling League                    │
│                                                     │
│   ─────── fine ligne dorée ───────────────────────   │
│                                                     │
│   ┌──────┐   L'AYATOLLAH                            │
│   │avatar│   Celui qui a créé un fichier...          │
│   │round │                                          │
│   └──────┘   ✉ contact@labordure.fr                 │
│              ☎ 06 XX XX XX XX                       │
│              🌐 labordure.fr                         │
│                                                     │
└─────────────────────────────────────────────────────┘
```

- **En-tête** : Logo La Bordure (`logo-bordure.png`) + nom "LA BORDURE" en vert foncé
- **Séparateur** : fine ligne dorée #C8963A
- **Corps** : avatar rond à gauche, surnom en gras + description en italique à droite
- **Contact** : email commun, téléphone (placeholder), site web — avec petites icônes
- **Palette** : fond crème #F6F3ED, texte vert #1B5E3B, accents dorés #C8963A, rose #E8A0B4 en touches

### Informations affichées

- Logo La Bordure (image `src/assets/logo-bordure.png`)
- Surnom du membre
- Description / rôle
- Avatar du membre
- contact@labordure.fr
- Téléphone (placeholder à modifier dans le PPTX)
- labordure.fr

### Implémentation

Script Node.js avec `pptxgenjs` :
1. Slide 16:9 avec contenu centré dans un cadre 85x55mm proportionnel
2. Logo en base64 en haut à gauche
3. Avatar en base64 rond
4. Texte de contact avec icônes Unicode
5. Ligne dorée séparatrice
6. QA visuelle via conversion PDF + images

### Fichiers sources
- `src/assets/logo-bordure.png` — logo
- `src/assets/team/*.png` — 10 avatars
- Données membres depuis `TeamPage.tsx`

### Sortie
- `/mnt/documents/cartes-visite-la-bordure-v2.pptx`

