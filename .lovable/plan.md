# Live : « Hors plage » alors qu'une plage est définie

## Ce qui se passe réellement

Deux choses se cumulent, vérifiées en base :

1. **Il y a un vrai trou dans les plages de l'étape 21.** Les plages saisies pour l'étape 21 (13 septembre) sont : 16:00–17:00, 17:00–19:30, puis 19:45–20:00. Il n'y a rien entre **19:30 et 19:45**. À 19:37 (heure de Paris), le système est donc légitimement hors plage. Le dernier import automatique date de 19:29, juste avant la fin de la plage de 19:30.

2. **L'écran ne regarde pas les plages de l'étape du jour.** L'indicateur en bas de la barre d'import calcule l'état à partir des plages générales de la course (11:00–15:00 / 15:00–16:00 / 16:00–17:30), et pas des plages saisies dans l'onglet Planning pour l'étape du jour. Résultat : même dans une plage définie au niveau de l'étape, l'écran peut afficher « Hors plage » à tort. Le serveur, lui, utilise bien les plages de l'étape du jour.

## Corrections

1. L'indicateur de la barre d'import utilise les plages de **l'étape du jour** (Planning) quand elles existent, et retombe sur les plages générales de la course sinon — exactement la même règle que le serveur.
2. Au lieu d'un simple « Hors plage », afficher l'heure de reprise quand une plage plus tardive existe le même jour : « ⏸ Hors plage — reprise à 19:45 ». Si aucune plage ne reste dans la journée : « ⏸ Terminé pour aujourd'hui ».
3. Ajouter sous l'indicateur la mention de la source des plages utilisées (« plages de l'étape 21 » ou « plages de la course »), pour lever toute ambiguïté.
4. Évaluer les heures en heure de Paris côté écran (aujourd'hui c'est l'heure du navigateur), afin que l'affichage soit correct même pour un admin dans un autre fuseau.

Aucun changement de la logique d'import côté serveur : elle fonctionne déjà comme attendu.

## À décider (hors périmètre par défaut)

Le trou 19:30 → 19:45 de l'étape 21 est une saisie manuelle. Je peux, si tu veux, ajouter un contrôle dans l'éditeur de plages signalant les trous entre plages consécutives d'une même étape.

## Détails techniques

- `src/pages/admin/SuperAdminLiveBroadcastPage.tsx` : charger le plan du jour (`live_stage_plans` filtré sur `course_id`, `is_enabled`, `stage_date` = date Paris) et l'utiliser comme source de plages pour l'indicateur, avec repli sur `arena_live_courses.scrape_schedule`.
- `src/components/arena/ScrapeScheduleEditor.tsx` : `getActiveInterval` évalue les minutes via `Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', hour, minute })` ; ajout d'un utilitaire `getNextWindowStart(schedule, now)` renvoyant le prochain début de plage du jour.
- `src/components/admin/live/LiveImportBar.tsx` : nouvelles props `scheduleSource` et `nextWindowStart` pour l'affichage enrichi ; aucune modification du bouton Importer / Auto.
