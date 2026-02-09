

## Diagnostic et Plan de correction du Startlist Tracker

### Probleme identifie

Le scraping **global** du Startlist Tracker echoue silencieusement car **ProCyclingStats bloque l'acces a la page "startlist changes"** (`races.php?s=startlist-changes-all-races`). Le serveur PCS retourne du HTML (26 450 caracteres) mais il ne contient aucun lien vers les courses -- il s'agit probablement d'une page anti-bot, captcha ou consentement cookies.

Preuve dans les logs :
- `Fetched HTML: 26450 characters`
- `parseChangedRacesHtml: found 0 race links`
- `extracted 0 races`

En revanche, le scraping d'une course individuelle fonctionne parfaitement (test TdF reussi avec matching complet).

---

### Strategie de correction

Abandonner la dependance a la page "startlist changes" de PCS et la remplacer par une approche directe : **scraper les startlists des courses a venir** directement depuis notre base de donnees.

```text
AVANT (casse) :
  Cron --> PCS changes page --> [BLOQUE] --> 0 courses --> fin

APRES (robuste) :
  Cron --> DB : courses des 6 prochaines semaines
       --> Pour chaque course : construire URL PCS
       --> Scraper startlist individuelle (fonctionne)
       --> Comparer avec entries existantes
       --> Detecter ajouts/retraits
```

---

### Etapes de mise en oeuvre

#### 1. Nouvelle logique "global sync" dans l'edge function `startlist-tracker`

Remplacer `scrapeChangedRacesList()` par une approche basee sur la DB :

- Requeter les courses dont la `date_debut` est dans les **6 prochaines semaines**
- Pour chaque course, construire l'URL PCS a partir de :
  - `pcs_slug` si disponible dans la table `courses`
  - Sinon, deriver un slug depuis le `course.id` ou `course.nom` (avec normalisation)
- Limiter a `MAX_COURSES_PER_RUN = 5` pour eviter les timeouts (150s)
- Garder un suivi des courses deja scrapees recemment (via `startlist_tracker_runs` ou un champ `last_scraped_at` sur `startlist_imports`) pour ne pas re-scraper la meme course toutes les 30 minutes

#### 2. Construction intelligente des URLs PCS

Creer une fonction `buildPcsStartlistUrl(course)` :
- Si `pcs_slug` existe : `https://www.procyclingstats.com/race/{pcs_slug}/2026/startlist`
- Sinon : essayer de deriver le slug depuis `course.id` (ex: `cadel-evans-great-ocean-road-race-mj8c3myx` devient `cadel-evans-great-ocean-road-race`)
- Ajouter un fallback avec le nom normalise

#### 3. Rotation et priorisation des courses

Pour eviter de scraper les memes courses en boucle :
- Stocker `last_tracker_check` (timestamp) dans `startlist_imports` ou via les `startlist_tracker_runs`
- Prioriser les courses jamais verifiees ou non verifiees depuis plus de 6h
- Cela permettra au cron de couvrir toutes les courses progressivement (5 par execution, toutes les 30 minutes)

#### 4. Ajout de logging diagnostique

Ajouter un log des 500 premiers caracteres du HTML recu + le titre de la page pour diagnostiquer les futurs blocages PCS :
```
console.log(`HTML title: ${doc.querySelector('title')?.textContent}`);
console.log(`HTML preview: ${html.substring(0, 500)}`);
```

#### 5. Migration base de donnees

Ajouter une colonne `last_tracker_check` a la table `startlist_imports` (ou `courses`) pour tracker la derniere verification de chaque course :

```sql
ALTER TABLE courses ADD COLUMN IF NOT EXISTS last_tracker_check timestamptz;
```

---

### Avantages de cette approche

- **Robustesse** : ne depend plus d'une page PCS unique qui peut etre bloquee
- **Fiabilite** : les pages de startlist individuelles fonctionnent (prouve par les tests)
- **Couverture** : toutes les courses a venir sont verifiees, meme celles non listees sur la page "changes"
- **Progressif** : 5 courses par run, toutes les 30 min = ~240 verifications par jour, largement suffisant

### Risques et mitigations

- **Blocage IP par PCS** : limiter a 5 courses/run avec des delais entre requetes (deja en place)
- **Slug PCS inconnu** : la derivation automatique couvrira la majorite des cas ; les echecs seront logues pour correction manuelle via `pcs_slug`
- **Course sans startlist import** : le systeme en creera une automatiquement (logique existante)

