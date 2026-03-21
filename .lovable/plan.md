

## Amélioration du Live Broadcast — Scraping de course en direct

### Contexte
Tu scrapes déjà PCS avec `fetch` + `DOMParser` (regex fallback) dans `scrape-pcs-results` et `startlist-tracker`. On réutilise exactement cette approche pour scraper les pages live de FirstCycling (ou PCS) et alimenter le Live Broadcast.

### Architecture

```text
Admin colle une URL (ex: firstcycling.com/race.php?r=13&y=2025&e=3)
        │
        ▼
Edge Function: scrape-live-race
  ├─ fetch HTML + DOMParser (même pattern que startlist-tracker)
  ├─ Parse la situation de course (groupes, écarts, coureurs)
  ├─ Parse la timeline d'événements (intermédiaires, chutes, attaques)
  ├─ Match coureurs avec startlist_entries (tokenSig, fuzzy)
  └─ Retourne { timeline: [...], situation: { groups, kmRemaining } }
        │
        ▼
Frontend: SuperAdminLiveBroadcastPage enrichi
  ├─ Champ URL + bouton "Importer"
  ├─ Timeline d'événements (clic → broadcast)
  ├─ Situation pré-remplie dans RaceSituationEditor
  └─ Affichage manager pour chaque coureur
```

### Plan d'implémentation

**1. Edge Function `scrape-live-race`**

| Fichier | Action |
|---------|--------|
| `supabase/functions/scrape-live-race/index.ts` | Créer |

- Accepte `{ url: string, course_id: string }`
- `fetch(url)` avec User-Agent (même pattern que `scrapeRaceStartlist`)
- Parse HTML avec `DOMParser` (deno_dom) :
  - Détecte le site source (FirstCycling, PCS) via l'URL
  - Extrait les données structurées selon le format du site
  - FirstCycling : timeline dans les tableaux de résultats intermédiaires, situation dans les classements en cours
- Match les noms de coureurs extraits avec les `startlist_entries` de la course (via `tokenSig` + `normalize` réutilisés depuis `_shared/normalization.ts`)
- Lookup `rosters` pour associer chaque coureur à son manager
- Retourne :
  ```json
  {
    "timeline": [{ "time": "14:32", "type": "intermediate", "text": "Sprint intermédiaire km 85", "riders": [...] }],
    "situation": { "groups": [...], "kmRemaining": 120 },
    "matched_riders": { "coureur_id": { "manager_name": "...", "rider_nom": "..." } }
  }
  ```

**2. Refonte `SuperAdminLiveBroadcastPage`**

| Fichier | Action |
|---------|--------|
| `src/pages/admin/SuperAdminLiveBroadcastPage.tsx` | Modifier |

- Ajouter un champ URL + bouton "Importer depuis le live" au-dessus de la section Situation
- Appel `supabase.functions.invoke("scrape-live-race", ...)` 
- Les données importées pré-remplissent :
  - Le `RaceSituationEditor` (groupes, coureurs, écarts, km)
  - Une nouvelle section Timeline
- Layout 2 colonnes en desktop : Composer + Timeline à gauche, Situation à droite

**3. Composant `RaceTimeline`**

| Fichier | Action |
|---------|--------|
| `src/components/arena/RaceTimeline.tsx` | Créer |

- Liste chronologique des événements importés
- Chaque événement affiche : heure, type (badge), texte, coureurs mentionnés (avec manager)
- Bouton "Diffuser" par événement → appelle `handleSend` avec le texte pré-formaté
- Édition inline optionnelle du texte avant envoi

**4. Enrichir `RaceSituationEditor` avec import**

| Fichier | Action |
|---------|--------|
| `src/components/arena/RaceSituationEditor.tsx` | Modifier |

- Ajouter une prop `importedSituation?: RaceSituation` qui pré-remplit les groupes
- Quand les données arrivent du scraper, les groupes/km sont automatiquement injectés
- Affichage du nom du manager à côté de chaque coureur sélectionné (lookup via prop `rosterOwners`)

**5. Affichage managers dans `RaceSituationDisplay`**

| Fichier | Action |
|---------|--------|
| `src/components/arena/RaceSituationDisplay.tsx` | Mineur |

- Déjà supporté via `rosterOwners` — s'assurer que la prop est passée depuis la page broadcast

### Aucune dépendance externe
Pas besoin de Firecrawl : on utilise `fetch` natif + `DOMParser` comme dans les scrapers existants. Zéro API key supplémentaire.

### Résumé des fichiers

| Fichier | Action |
|---------|--------|
| `supabase/functions/scrape-live-race/index.ts` | Créer |
| `src/pages/admin/SuperAdminLiveBroadcastPage.tsx` | Refonte layout + import URL |
| `src/components/arena/RaceTimeline.tsx` | Créer |
| `src/components/arena/RaceSituationEditor.tsx` | Ajouter prop import + managers |
| `src/components/arena/RaceSituationDisplay.tsx` | Mineur — passer rosterOwners |

