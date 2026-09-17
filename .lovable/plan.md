# Activer l'import auto quand un planning d'étapes est saisi

## Ce qui se passe aujourd'hui

Les 3 courses par étapes en cours (Tour de Luxembourg, Tour de Slovaquie, Giro d'Abruzzo) ont bien une ligne de planning pour aujourd'hui avec un lien live. Mais l'import auto est éteint sur les trois, et le bouton refuse de l'allumer : il exige un lien saisi dans la barre du haut, alors que deux de ces courses n'en ont aucun au niveau course (tout est dans le planning). D'où le message « Entrez une URL d'abord ».

Second problème : même quand on arrive à l'activer, l'enregistrement réécrit le lien global de la course avec le champ affiché — donc potentiellement du vide — au lieu de laisser le planning faire foi.

Le serveur, lui, sait déjà utiliser le planning du jour en priorité. Il n'y a donc rien à corriger côté automatisation : seule l'activation est bloquée.

## Ce qui va changer

- Le bouton « Auto » s'active dès qu'il existe, pour la course, une étape planifiée aujourd'hui avec un lien — même si la barre du haut est vide.
- Le message d'erreur devient explicite : il ne bloque que s'il n'y a ni lien global, ni planning du jour utilisable.
- L'activation n'écrase plus le lien global ni les plages horaires avec des valeurs vides : on n'écrit que ce qui est réellement renseigné.
- Sous le bouton, une mention indique la source utilisée : « planning du jour (étape N) » ou « réglage global de la course ».
- Les trois courses concernées seront ensuite activables en un clic depuis l'écran Live Broadcast.

## Détails techniques

- `src/pages/admin/SuperAdminLiveBroadcastPage.tsx`
  - Nouvelle lecture (react-query) de `live_stage_plans` pour `activeCourseId` avec `is_enabled = true` et `stage_date = date du jour (Europe/Paris)` → `todayPlan`.
  - `handleToggleAuto` : condition d'activation = `scrapeUrl || todayPlan?.scrape_url`; condition plages = `schedule.length || todayPlan.scrape_schedule?.length`.
  - Le `update` sur `arena_live_courses` ne contient `live_scrape_url` que si `scrapeUrl` est non vide, et `scrape_schedule` que si `schedule.length > 0`.
  - Passe un libellé de source à `LiveImportBar` (prop `scheduleSource` déjà existante) : plan du jour vs course.
- `src/components/admin/live/LiveImportBar.tsx` : `onImport`/bouton « Importer » inchangés (ils ont toujours besoin d'une URL saisie) ; seul le libellé de source évolue.
- Aucun changement dans `supabase/functions/live-broadcast-auto-scrape` ni dans la table `live_stage_plans`.

## Hors périmètre

- Pas d'activation automatique de l'auto-import sans clic de l'admin.
- Pas de changement de la logique de scraping ni des plages horaires par défaut.
