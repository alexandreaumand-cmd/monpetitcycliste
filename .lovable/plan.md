## Nouvelle règle « Mode À la course »

| Sélection | Budget | Coureurs |
|---|---|---|
| Au moins 1 Grand Tour (TdF / Giro / Vuelta) | 1 100 | 15 |
| Au moins 1 course par étapes non-GT (CPE) | 1 100 | 10 |
| Une seule classique (one-day) | 650 | 8 |
| Plusieurs classiques (one-day) | 800 | 10 |

Priorité d'évaluation : GT > CPE non-GT > classiques (1 ou plusieurs).

## Modifications

### 1. Logique métier
**`src/lib/leagues/templates.ts`** — Réécrire `computePerCourseSettings` :
- Si une course est GT → `{ 1100, 15 }`
- Sinon si une course est `stage_race` → `{ 1100, 10 }`
- Sinon (toutes `one_day`) : 1 course → `{ 650, 8 }`, plusieurs → `{ 800, 10 }`

**`supabase/functions/leagues-create/index.ts`** (lignes 148-157) — Appliquer la même logique côté serveur.

### 2. Textes des règles
**`src/pages/RulesPage.tsx`** (lignes 496-509, carte « Mode À la course ») — 4 lignes :
- 🟡 Grand Tour : **1 100 / 15 coureurs**
- 🏔️ Course par étapes (non-GT) : **1 100 / 10 coureurs**
- 🚴 1 classique : **650 / 8 coureurs**
- 🚴‍♂️ Plusieurs classiques : **800 / 10 coureurs**

**`src/components/landing/RulesHighlightsSection.tsx`** (ligne 27) — Mettre à jour la réponse FAQ pour refléter les 4 cas.

### 3. i18n landing
**`src/i18n/locales/fr/home.json`** — `gameModes.alaCourse` :
- `description` : reformuler pour décrire les 4 cas (1 classique 650/8, plusieurs 800/10, CPE 1100/10, GT 1100/15)
- `specs.roster` : « 8 à 15 coureurs selon la sélection »
- `specs.budget` : « 650 à 1 100 M€ selon la sélection »

**`src/i18n/locales/en/home.json`** — équivalent anglais.

## Non inclus
- Pas de modif BD (la ligue Tour AuRA reste à max_riders=10 — c'est cohérent avec la nouvelle règle CPE non-GT).
- Pas de modif du mode 5 Phases.