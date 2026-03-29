

## Cartes de visite La Bordure — PPTX élégant minimaliste

### Concept

Un fichier PPTX avec **10 slides** (une par membre), chaque slide contenant une carte de visite au format paysage. Style épuré reprenant l'identité La Bordure : fond crème (#F6F3ED), texte vert (#1B5E3B), accents dorés (#C8963A), typographie fine.

### Layout de chaque carte (sur un slide 16:9)

```text
┌─────────────────────────────────────────────────┐
│  fond crème #F6F3ED                             │
│                                                 │
│     ┌──────┐                                    │
│     │avatar│   L'AYATOLLAH                      │
│     │circle│   ─── ligne dorée ───              │
│     └──────┘   Description en italique          │
│                                                 │
│         ── LA BORDURE ──    labordure.fr         │
│                                                 │
└─────────────────────────────────────────────────┘
```

- Avatar du membre (image ronde, ~1.5" de diamètre)
- Surnom en Montserrat bold, vert foncé, grande taille
- Ligne de séparation dorée fine
- Description en italique, vert/60%
- Logo/nom "LA BORDURE" en bas avec un filet doré
- Le tout centré verticalement

### Implémentation

**Script Node.js** utilisant `pptxgenjs` :

1. Créer une présentation 16:9
2. Pour chaque membre du tableau `members` (10 membres) :
   - Ajouter un slide avec fond crème
   - Intégrer l'avatar en base64 avec `rounding: true`
   - Ajouter le surnom, la ligne dorée, la description
   - Ajouter le pied "LA BORDURE"
3. Exporter en `.pptx` dans `/mnt/documents/`

### Fichiers utilisés
- `src/assets/team/*.png` — avatars des 10 membres
- Données des membres depuis `TeamPage.tsx`

### Sortie
- `/mnt/documents/cartes-visite-la-bordure.pptx`

