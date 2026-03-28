

## Plan : Ajouter PCS comme source de situation de course en live

### Contexte

Le scraper actuel (`scrape-live-race`) supporte L'Equipe, PCS (résultats uniquement) et FirstCycling. La page PCS **live/livestats** contient une section "Situation" très structurée avec :
- Des groupes nommés (The Breakaway, First chase group, peloton)
- Des écarts précis (+0:10, +2:25)
- Des coureurs avec dossard, nom, slug PCS et classement GC
- Des km restants, vitesse, temps de course

### Ce qui change

Ajouter un parser `parsePCSLiveSituation` dans l'edge function `scrape-live-race/index.ts` qui extrait la situation de course structurée depuis la page PCS livestats, en complément du parser L'Equipe existant.

### Structure HTML PCS à parser

```text
### Situation
- 10                          ← rider count
  The Breakaway               ← group name  
  +0:00??                     ← gap
  - 1  14  SOLER Marc  +15:43 ← bib, rider link, GC time
  - 2  222 MUNTON Byron +7:58

- 20
  First chase group
  +0:10??
  - 1  6  CATTANEO Mattia ...

- P0
  peloton
  +2:25??
```

Infos course en haut :
- `KM to go: 61.8` / `km done: 96.3` / `Avg. 40.4` / `Status: racing`

### Implémentation

**Fichier** : `supabase/functions/scrape-live-race/index.ts`

1. **Nouvelle fonction `parsePCSLive(doc, html)`** qui retourne `{ riders, events, situation }` comme `parseLEquipeLive` :
   - Extraire km to go, km done, avg speed depuis les éléments `li` en haut de page
   - Parser la section "Situation" : chaque groupe est un bloc avec count, nom, gap, puis liste de coureurs avec dossard + lien `/rider/slug`
   - Extraire la timeline PCS si disponible
   - Matcher les coureurs via le slug PCS (`rider/marc-soler` → `coureurs.pcs_slug`)

2. **Modifier la branche `isPCS`** (ligne 557) pour appeler `parsePCSLive` au lieu de `parsePCSResults` quand l'URL contient `/live`

3. **Matching amélioré via PCS slug** : quand la source est PCS, utiliser le slug extrait des liens (`/rider/marc-soler`) pour matcher directement avec `coureurs.pcs_slug` en base, en plus du matching par nom existant

### Avantages vs L'Equipe
- Données structurées (pas de parsing de texte brut)
- Slugs PCS pour matching précis des coureurs
- Dossards inclus
- Moins de faux positifs

### Fichier impacté
- `supabase/functions/scrape-live-race/index.ts` — ajout `parsePCSLive`, modification branche PCS pour URLs live

