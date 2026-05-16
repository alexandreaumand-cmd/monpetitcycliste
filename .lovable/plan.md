## Objectif

Rendre les jours de repos visibles partout où le calendrier affiche les courses par étapes, en s'appuyant sur les `stage_date` saisis dans `course_stage_config`.

## Définition d'un jour de repos

Pour une course `type_course = 'stage_race'` :
- jour de repos = date comprise entre `course.date_debut` et `course.date_fin` qui **n'apparaît pas** dans `course_stage_config.stage_date` pour ce `course_id`.
- Si aucune `stage_date` n'est configurée pour la course → on ne déduit aucun jour de repos (fallback silencieux), on garde le rendu actuel.

Un petit hook partagé `useStageDatesByCourse(courseIds: string[])` (`src/hooks/useStageDates.ts`) charge en un seul `select` `course_id, etape_numero, stage_date` pour tous les ids visibles et expose deux helpers :
- `getStageDates(courseId)` → `Set<string>` des dates d'étapes (yyyy-MM-dd)
- `isRestDay(courseId, dayIso, dateDebut, dateFin)` → `boolean`

## 1. Vue calendrier de la Startlist (desktop + mobile)

Fichiers :
- `src/components/startlist/StartlistCalendarView.tsx`
- `src/components/startlist/StartlistCalendarMobile.tsx`

Changements :
- Charger les `stage_date` pour toutes les courses `stage_race` du mois affiché via le hook ci-dessus.
- Quand on construit `coursesByDay`, pour chaque jour d'un grand tour qui n'est ni dans `stage_date` ni le `date_debut`/`date_fin`, **ne pas** ajouter la course comme pill colorée standard, mais ajouter à la place une marque "Repos" (objet léger `{ kind: 'rest', course }`).
- Rendu cellule desktop : pill grise/striée `Coffee  Repos · <nom court course>`, non cliquable (ou cliquable et ouvre le dialog course comme aujourd'hui).
- Rendu cellule mobile : un petit point gris + tooltip / bottom sheet "Jour de repos – Giro".
- Légende ajoutée (sous le calendrier) : "🍵 Repos".

## 2. Page Calendrier (`/calendar`)

Fichier : `src/pages/CalendarPage.tsx` + `src/components/calendar/CalendarCourseDialog.tsx`

C'est une vue **tableau**, donc on n'ajoute pas de ligne "Repos" séparée. À la place :

a. Sur la ligne (et la card mobile) d'un grand tour : nouveau badge gris discret `🍵 N jr repos` à côté de la catégorie quand au moins une `stage_date` est définie et qu'il existe au moins un jour de repos.

b. Dans le `CalendarCourseDialog`, nouvelle petite section "Programme" (visible uniquement pour `stage_race`) qui liste, du `date_debut` au `date_fin` :
   - chaque étape (`Étape N — date`) si `stage_date` connue ;
   - les jours sans étape sont rendus en gris avec libellé `Repos — <date>`.

Si aucune `stage_date` n'est encore configurée pour la course, on n'affiche pas la section et le badge n'apparaît pas (rétrocompatibilité).

## Hors scope

- Édition des dates depuis ces vues (déjà disponible dans le superadmin).
- Re-calcul des `date_classement` historiques.
- Affichage des jours de repos dans la page Course publique (`Upcoming`, etc.) — à voir séparément si besoin.

## Détails techniques

- Le hook `useStageDates` accepte un tableau d'ids et retourne `{ data, isLoading }`. Cache `react-query` clé `['stage-dates', sortedIds.join(',')]`.
- Les composants existants reçoivent `type_course` déjà dans leurs données (déjà sélectionné via `select('*')` ou champ explicite à ajouter pour la startlist calendar view si manquant).
- Aucune nouvelle dépendance ; on réutilise l'icône `Coffee` (lucide), déjà importée ailleurs.
