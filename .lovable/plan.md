## Objectif

Deux améliorations au Live Broadcast :

1. Permettre au superadmin de sélectionner explicitement l'étape en cours d'une course par étapes, et la rendre visible aux utilisateurs des ligues.
2. Corriger le parsing PCS pour les courses par étapes : ne pas confondre l'écart au CG de chaque coureur avec l'écart entre groupes.

---

## 1. Étape en cours visible côté utilisateurs

### Stockage
Ajouter une colonne `current_etape int null` sur `arena_live_courses` pour persister l'étape active de chaque course en direct.

### Côté superadmin (`SuperAdminLiveBroadcastPage.tsx`)
- L'input "Étape" déjà présent dans le composer devient la source de vérité de l'étape active.
- Quand `isMultiStage` et `selectedEtape` change → update `arena_live_courses.current_etape`.
- Au chargement d'une course active, lire `current_etape` depuis la DB pour pré-remplir `selectedEtape` (fallback à 1).
- Déplacer le sélecteur d'étape dans une petite barre dédiée en haut (plus visible) avec libellé "Étape couverte en direct".

### Côté ligues (`LiveCoursePanel.tsx` + `LiveCoursesTab.tsx`)
- Lire `current_etape` via le hook `useLiveCourses` (à étendre pour exposer le champ).
- Afficher un badge bien visible à côté du nom de la course : "🔴 Étape N en direct".
- Pré-sélectionner automatiquement `selectedEtape = current_etape` à l'ouverture du panel pour que l'historique filtré montre directement la bonne étape.
- Garder le sélecteur d'étapes existant pour permettre de revenir aux étapes précédentes.

---

## 2. Fix parsing situation pour courses par étapes

### Problème
Sur PCS pour une étape de Grand Tour (cf. capture) :
- Une seule échappée (4 coureurs), avec écart `+5:33` au peloton.
- Chaque coureur affiche en plus son **écart au classement général** (ex. `+46:22`, `+22:13`).

Le scraper actuel (`supabase/functions/scrape-live-race/index.ts`) :
- Crée parfois un groupe par coureur (chaque `.sit-grp` hoisté en top-level passe le filtre car il contient un nom de groupe ou un lien rider).
- Le fallback regex `\+(\d+:\d+)` capture les écarts CG comme s'ils étaient des écarts de groupe.

Résultat : 4 "groupes" d'1 coureur avec `+46:22`, `+22:13`, `+53:38`, `+37:49` au lieu d'1 seul groupe `Early break` avec `+5:33`.

### Correction (edge function uniquement)
- **Identifier les `.sit-grp` qui sont en réalité des lignes coureurs** (1 seul rider link, pas de mot-clé groupe `peloton|breakaway|échappée|early|head|chase|leaders|group`) et les **regrouper avec le `.sit-grp` parent** (le vrai groupe au-dessus dans le DOM) au lieu de les exposer comme groupes séparés.
- **Écart de groupe** : extraire uniquement depuis le **header** du `.sit-grp` (texte avant le 1er rider link). Les `+M:SS` / `+H:MM:SS` lus à côté de chaque rider sont stockés comme `riderGcGaps` (déjà le cas) mais ne doivent **jamais** écraser `gap`.
- **Détection course par étapes** : passer `is_stage_race` à la fonction (depuis le front via `course.type_course === "stage_race"` ou via `date_debut !== date_fin`). Quand vrai :
  - Forcer la règle "1 gap par groupe = header uniquement".
  - Ignorer le fallback regex global qui mélange GC et écarts d'étape (n'utiliser que le DOM-based parsing).
- **Fallback texte** (lignes 320+) : appliquer la même règle — ne traiter `+M:SS` comme gap de groupe que s'il est précédé d'un libellé de groupe (`Peloton`, `Early break`, `Group N`…), sinon l'ignorer.

### Garde-fou affichage
Dans `RaceSituationDisplay.tsx`, si tous les groupes (hors peloton) ont des `gap` qui ressemblent à des écarts CG (≥ 10 minutes ET un seul rider chacun), c'est un signal que le parsing est resté pollué — logguer un warning serveur côté edge function pour faciliter le debug.

---

## Détails techniques

- Migration SQL : `ALTER TABLE arena_live_courses ADD COLUMN current_etape int;`
- Hook `useLiveCourses` : ajouter `current_etape` au select.
- Nouveau hook utilitaire `useUpdateLiveCourseStage(courseId, etape)` (mutation simple) côté admin.
- `scrape-live-race/index.ts` : refactor de la boucle `sitGroups.forEach` pour fusionner les sub-`.sit-grp` rider-only dans leur parent et enlever les writes accidentels de `gap` depuis les rider rows.
- Aucun changement nécessaire sur le format `RaceSituation` ni sur l'éditeur — uniquement le contenu des groupes envoyés.

## Hors scope
- Calendrier complet des 21 étapes (sujet précédent, non demandé ici).
- Changement de l'UI de l'éditeur de situation (reste manuel si besoin).
