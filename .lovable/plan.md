# Live des étapes : l'étape « en direct » reste bloquée sur la veille

## Ce qui se passe

Vérifié en base : le planning du jour (25/08) existe bien pour l'étape 4 de la Vuelta, mais la ligne live de la course porte encore `current_etape = 3` et le lien de l'étape 3 (dernier import : 24/08 17:29).

Cause : dans le cron d'import automatique, la mise à jour de l'étape courante et du lien live à partir du planning du jour n'est effectuée **qu'au moment où un import est réellement lancé**. Or, hors plage horaire, la course est ignorée avant cette étape. Résultat : tant que la première plage horaire du jour n'a pas été atteinte, l'application (Arène et super-admin) continue d'afficher l'étape de la veille comme « en direct ».

Second point : le bandeau « Étape X en direct » s'affiche dès qu'une course est active, sans tenir compte des plages horaires — donc il reste affiché en pleine matinée ou après l'arrivée.

## Correctifs

1. **Alignement de l'étape dès le début du cron** : pour chaque course active, si un planning existe pour la date du jour (heure de Paris), synchroniser immédiatement `current_etape` et le lien live — avant les contrôles de plage horaire et d'intervalle. Sans planning pour aujourd'hui, ne rien changer (comportement actuel conservé).

2. **Bandeau « en direct » honnête** : n'afficher « Étape X en direct » que si l'heure de Paris est dans une plage horaire du planning du jour. Hors plage :
   - avant la première plage : « Étape X — départ prévu » (état à venir, sans point rouge clignotant) ;
   - après la dernière plage : « Étape X — terminée ».
   L'étape affichée reste celle du planning du jour, donc plus jamais celle de la veille.

3. **Super-admin (écran Live Broadcast)** : l'étape présélectionnée et l'en-tête utilisent l'étape du planning du jour lorsqu'elle existe, au lieu de la valeur stockée potentiellement obsolète, avec le même indicateur d'état (à venir / en direct / terminée).

## Détails techniques

- `supabase/functions/live-broadcast-auto-scrape/index.ts` : déplacer le bloc de synchronisation `arena_live_courses` (`current_etape`, `live_scrape_url`) juste après la résolution du plan du jour, avant `getActiveInterval` et le test d'intervalle. Redéploiement de la fonction.
- Nouveau petit hook front (ex. `src/hooks/useLiveStagePlanToday.ts`) : lit `live_stage_plans` pour `stage_date = aujourd'hui (Europe/Paris)` et `is_enabled = true`, et calcule l'état `upcoming | live | finished` à partir de `scrape_schedule` (repli sur `arena_live_courses.scrape_schedule`), rafraîchi chaque minute.
- `src/components/arena/LiveCoursePanel.tsx` et `src/components/arena/LiveCoursesTab.tsx` : remplacer le badge en dur par cet état ; libellés via `src/i18n/locales/{fr,en}/arena.json`.
- `src/pages/admin/SuperAdminLiveBroadcastPage.tsx` et `src/components/admin/live/ActiveCourseHeader.tsx` : présélection et badge basés sur le même hook.

Aucun changement de schéma de base de données.
