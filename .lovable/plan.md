# Réparer l'import Live Broadcast

## Diagnostic

L'import retourne `0/0 coureurs matchés`. Les logs de la fonction `scrape-live-race` confirment :

```
[PCS Live] km remaining: 63, km done: 92.8, speed: 50.4 km/h   ← OK
[PCS Live] Found 0 .sit-grp elements                           ← KO
[PCS Live] Real groups retained: 0
[scrape-live-race] Parsed 0 riders, 0 events
```

Le parser cherche `.sit-grp`. **procyclingstats.com a changé la structure du DOM de ses pages /live**. En récupérant la vraie page (`https://www.procyclingstats.com/race/giro-d-italia/2026/stage-8/live`) on voit :

```text
ul.situ5b
└── li.group               ← un groupe
    ├── div.bol            → font = rang, span[data-nr=N] = nb coureurs
    ├── div.groupname      → nom (souvent vide)
    ├── div.time[data-sec] → écart, ex "+0:42"
    └── ul
        └── li             ← un coureur
            ├── span.nr               → rang dans le groupe
            ├── span.shirt_icon20 teamXXX  (title = équipe)
            ├── div.bib               → dossard
            ├── a[href*='rider/']     → nom (BJERG Mikkel)
            ├── span.flag c16 xx      → pays
            └── div.gc                → temps GC (+54:42)
```

La capture n°2 (BJERG, NARVÁEZ, LEKNESSUND + Peloton +0:50) correspond exactement à cette structure et doit redevenir visible dès que le parser est aligné.

## Changements

### 1. `supabase/functions/scrape-live-race/index.ts`

Réécrire la section "Parse situation groups" de `parsePCSLive` :

- Remplacer `doc.querySelectorAll(".sit-grp")` par `doc.querySelectorAll("ul.situ5b > li.group")`.
- Pour chaque `li.group` :
  - **gap** : lire `.time` (utiliser `data-sec` si présent pour fiabilité, sinon textContent en virant le `<font>??</font>`).
  - **riderCount** : `.bol span[data-nr]` → `parseInt(data-nr)` (fiable, plus besoin de compter les liens).
  - **groupName** : `.groupname` textContent ; si vide, déduire (`Peloton` si `riderCount` ≥ 20 ou si c'est le plus gros groupe restant, sinon `Échappée` / `Groupe N`).
  - **isPeloton** : `riderCount` ≥ 20 OU plus grand groupe.
  - **coureurs** : `ul > li` enfants directs ; pour chacun extraire :
    - nom : `a[href*='rider/']` textContent
    - slug : `href` après `rider/`
    - dossard : `.bib` textContent
    - équipe : `span[class*='shirt_icon'][title]` attribut `title`
    - écart GC : `.gc` textContent
- Conserver la logique aval : `riders.push(...)`, troncature à 15 (5 si peloton), nettoyage stage-race pour groupes parasites.
- Garder un **fallback** sur l'ancien sélecteur `.sit-grp` si jamais PCS revient en arrière (pour ne pas re-casser).
- Logs : `[PCS Live] Using ul.situ5b parser, found N li.group` pour pouvoir confirmer dans les logs.

### 2. Hors scope

- Pas de modification UI (`SuperAdminLiveBroadcastPage.tsx`, `LiveImportBar.tsx`, `ActiveCourseHeader.tsx`).
- Pas de modification DB, RLS, ou logique métier.
- Pas de modification du parser L'Équipe ni du parser PCS "results" (table.results) — uniquement le parser PCS **Live**.

## Validation

1. Coller l'URL `https://www.procyclingstats.com/race/giro-d-italia/2026/stage-8/live`, cliquer **Importer**.
2. Vérifier dans les logs edge : `Parsed >0 riders`, `Real groups retained: ≥2`.
3. Vérifier dans l'UI : "Situation de course" affiche au moins 2 groupes (tête + peloton) avec les noms BJERG / NARVÁEZ / LEKNESSUND et un Peloton avec écart `+0:50`.
4. Vérifier que les compteurs "X/Y coureurs matchés" sont > 0.
