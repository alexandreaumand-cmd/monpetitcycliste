## Objectif

1. Mettre à jour la **page Règles** (`/regles`) avec les éléments récents : mode "À la course", variante "World Tour uniquement", barème de points et bonus.
2. Ajouter sur la même page **deux nouvelles sections FAQ illustrées** pour la page **Calendrier** et la page **Données coureurs**.
3. Ajouter un **bouton aide "?"** à côté de la cloche de notifications sur la **Dashboard Home** (connectée), qui pointe vers `/regles`.
4. Compléter la **landing publique** avec une section FAQ condensée renvoyant vers `/regles`.

---

## 1. Page Règles (`src/pages/RulesPage.tsx`)

Ajouter de nouvelles `SectionCard` (le composant existant) **après** les sections existantes :

### Section "Modes de ligue"
- **Mode 5 Phases** (existant) : 2200 budget, 30 coureurs, enchères par phase.
- **Mode À la course** (nouveau) : sélection libre de courses, calcul auto :
  - 1 course d'un jour seule → 8 coureurs / 650 budget
  - Plusieurs courses d'un jour → 10 coureurs / 800 budget
  - Au moins une course à étapes → 15 coureurs / 1100 budget
  - Enchère unique avant le premier départ.
- **Variante "World Tour uniquement"** (nouveau) : inclut WT + Grands Tours + championnats du monde/continentaux ; exclut Pro Series et autres.

### Section "Bonus & scoreurs"
Bloc explicatif (déjà partiellement présent) à compléter / réorganiser :
- **Scoreurs** : nombre de coureurs comptés selon le type de course (ex : 4 sur les classiques, 8 sur les Grands Tours – récupérer les valeurs depuis `useScoringRules`).
- **Bonus première victoire** d'un coureur (Super Admin attribue).
- **Bonus porteurs de maillot** par jour (jaune, vert, pois, blanc…).
- **Bonus équipe TTT**.

### Nouvelle section "La page Calendrier" (FAQ accordéon)
Utiliser `Accordion` shadcn déjà importé. Items :
- Comment voir les startlists d'une course ?
- À quoi servent les **mouvements de startlists** affichés sur le détail d'une course ?
- Comment **ajouter un coureur en favori** depuis le calendrier (icône étoile) ?
- Filtrer par catégorie / mois / statut (à venir / en cours / terminée).
- Vue grille desktop vs vue compacte mobile.
- Capture : `/screenshots/calendar.webp` (à ajouter — voir section assets).

### Nouvelle section "La page Données Coureurs" (FAQ accordéon)
- Filtres disponibles : équipe, catégorie, courses, cotes, programme, **favoris uniquement**.
- Comment **mettre un coureur en favori** (étoile dans le tableau).
- Le **panneau latéral résultats** (slide-over) au clic sur un coureur.
- Export Excel.
- Capture : `/screenshots/data.webp`.

Ces deux sections sont rendues via une nouvelle sous-section `<RulesFAQSection icon={Calendar} title="…" items={[…]} screenshot="…" />` placée à la fin de la page, avant le CTA.

---

## 2. Bouton aide "?" sur Dashboard Home

Fichier : `src/components/dashboard/DashboardHomeHeader.tsx`

- Importer `HelpCircle` de `lucide-react` et `useNavigate`.
- Ajouter un `<button>` placé **juste avant** `<NotificationCenter />` dans les deux branches (mobile + desktop), avec le même style que les autres icônes header (bordure-gold + hover).
- `onClick` → `navigate('/regles')`.
- `aria-label` = "Aide" (à ajouter dans `dashboard.json` FR/EN sous `header.help`).

---

## 3. Landing publique (`src/pages/LandingPage.tsx`)

Ajouter une nouvelle section condensée **`RulesHighlightsSection`** (3-4 cartes FAQ) juste avant `CTASection` :
- "Comment fonctionnent les enchères ?"
- "Quels modes de ligue ?"
- "Comment marquer des points ?"
- "Pages Calendrier & Data : à quoi servent-elles ?"

Chaque carte = court résumé + lien "Voir toutes les règles" → `/regles`.

Style aligné `bg-bordure-cream`, accent gold/pink, accordéon shadcn.

---

## 4. Captures à ajouter

Dans `public/screenshots/` :
- `calendar.webp` (vue grille du calendrier avec une course ouverte montrant les mouvements startlist)
- `data.webp` (tableau Données Coureurs avec étoiles favoris visibles et panneau latéral)

→ Pendant l'implémentation je prendrai ces captures via `browser--screenshot` sur les routes `/dashboard/calendar` et `/dashboard/data`, puis les copierai dans `public/screenshots/`.

---

## 5. i18n

Ajouter clés FR + EN :
- `dashboard.json` : `header.help`
- `home.json` : nouvelle clé `rulesHighlights.*` (titre + 4 questions/réponses + CTA)
- `RulesPage.tsx` utilise du texte FR en dur (cohérent avec l'existant) → idem pour les nouvelles sections.

---

## Fichiers modifiés / créés

**Modifiés**
- `src/pages/RulesPage.tsx` (sections Modes, Bonus, FAQ Calendrier, FAQ Data)
- `src/components/dashboard/DashboardHomeHeader.tsx` (bouton "?")
- `src/pages/LandingPage.tsx` (insère nouvelle section)
- `src/i18n/locales/fr/dashboard.json`, `en/dashboard.json`
- `src/i18n/locales/fr/home.json`, `en/home.json`

**Créés**
- `src/components/landing/RulesHighlightsSection.tsx`
- `public/screenshots/calendar.webp`
- `public/screenshots/data.webp`

Aucune migration BDD, aucune Edge Function impactée.
