

## Plan : Alignement palette UI sur le mockup (UI only, aucun changement UX)

### Constat

Le mockup définit 6 couleurs précises. L'app actuelle en utilise des versions légèrement différentes, et surtout les **cards sont crème au lieu de blanches**.

| Élément | Actuel | Mockup | Delta |
|---|---|---|---|
| Vert forêt (header/nav) | `#1E4D2B` (147 45% 21%) | `#1B5E3B` (150 55% 24%) | Plus vif, plus clair |
| Or podium (CTA/accents) | `#C9922A` (38 66% 48%) | `#C8963A` (38 58% 50%) | Quasi identique, léger ajust |
| Rose sprint | `#E8A0B0` (346 52% 77%) | `#E8A0B4` (343 52% 77%) | Micro-ajust |
| Crème fond | `#F5F0E8` (38 38% 93%) | `#F6F3ED` (40 30% 95%) | Un poil plus clair/neutre |
| **Cards** | **Crème** (= fond) | **Blanc #FFFFFF** | **Changement majeur** |
| Foreground texte | `#1E4D2B` (vert foncé) | `#2D3D32` (vert texte) | Plus doux, moins saturé |
| Texte secondaire | `147 20% 40%` | `#8A9188` (gris peloton) | Nouveau gris verdâtre |
| Bordures | `147 20% 80%` | `#EAE6DE` (38 20% 89%) | Plus chaudes, plus fines |

### Changements

#### 1. `src/index.css` — Mettre à jour les CSS variables light mode

```
--background: 40 30% 95%;         /* Crème #F6F3ED */
--foreground: 153 16% 21%;        /* Vert texte #2D3D32 */

--bordure-green: 150 55% 24%;     /* #1B5E3B */
--bordure-gold: 38 58% 50%;       /* #C8963A */
--bordure-pink: 343 52% 77%;      /* #E8A0B4 */
--bordure-cream: 40 30% 95%;      /* #F6F3ED */

--card: 0 0% 100%;                /* Blanc pur #FFFFFF */
--card-foreground: 153 16% 21%;   /* Vert texte */

--primary: 38 58% 50%;            /* Or podium */
--secondary: 150 55% 24%;         /* Vert forêt */

--muted-foreground: 140 5% 55%;   /* Gris peloton #8A9188 */
--border: 38 20% 89%;             /* #EAE6DE */
--input: 38 20% 89%;
```

Ajuster aussi le dark mode en conséquence (vert forêt + gris peloton adaptés).

#### 2. `src/components/ui/card.tsx` — Bordure fine

Ajouter `border-[0.5px]` pour correspondre au style mockup (bordures très fines sur les cards blanches).

#### 3. `tailwind.config.ts` — Aucun changement structurel

Les custom colors (`bordure-green`, `bordure-gold`, etc.) pointent déjà sur les CSS variables. Ils suivront automatiquement.

### Résultat

- Cards blanches sur fond crème (contraste visuel net)
- Couleurs légèrement recalibrées pour correspondre au mockup
- Aucun changement de navigation, layout, composants, ou fonctionnalités

### Fichiers modifiés

| Fichier | Nature |
|---|---|
| `src/index.css` | CSS variables light + dark |
| `src/components/ui/card.tsx` | Bordure 0.5px |

