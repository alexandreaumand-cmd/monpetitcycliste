# Auto-import Live Broadcast sans page ouverte

## Diagnostic

Non, la page n'a pas besoin d'être ouverte : l'auto-import est déjà entièrement côté serveur. La page Live Broadcast ne fait que lire l'état (timestamps, dernière situation) — aucun scraping n'est déclenché depuis le navigateur.

Le vrai problème est un décalage d'horaire de 2 h :

- La tâche planifiée `live-broadcast-auto-scrape` tourne bien chaque minute (job cron actif).
- Les plages horaires saisies dans l'écran ("11:00–15:00", "15:00–16:00", "16:00–17:30") sont comprises par l'admin en heure de Paris, mais la fonction serveur les compare à l'heure **UTC**.
- Résultat vérifié en base : la course La Vuelta (étape 3) a `auto_scrape_enabled = true`, mais `next_auto_scrape_at` est vide et le dernier auto-import date de 17:29 UTC (19:29 Paris) — c'est-à-dire que les plages sont appliquées avec 2 h de retard. À 11:44 Paris (09:44 UTC), la fonction considère qu'on est « hors plage » et ne fait rien.

C'est pourquoi l'impression est que « ça ne marche que quand la page est ouverte » : dans la journée, les seuls imports qui aboutissent sont les clics manuels sur « Importer ».

## Correction

1. Évaluer les plages horaires en heure de Paris (Europe/Paris) dans la fonction serveur `live-broadcast-auto-scrape`, au lieu de l'heure UTC du serveur — avec gestion automatique de l'heure d'été/hiver.
2. Ajouter des logs explicites à chaque passage (heure Paris, plage active, nombre de courses traitées/ignorées) pour pouvoir vérifier le fonctionnement sans ouvrir la page.
3. Afficher clairement dans l'écran que les plages sont en heure de Paris (mention sous l'éditeur de plages), pour éviter toute ambiguïté future.

## Vérification

- Déclenchement de la fonction et lecture des logs : la plage 11:00–15:00 (Paris) doit être reconnue comme active à l'heure actuelle.
- Contrôle en base que `last_auto_scrape_at` / `next_auto_scrape_at` se mettent à jour, page fermée.

## Détails techniques

- `supabase/functions/live-broadcast-auto-scrape/index.ts` : `getActiveInterval` reçoit les minutes calculées via `Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', hour, minute })` au lieu de `now.getHours()/getMinutes()`.
- `src/components/arena/ScrapeScheduleEditor.tsx` / `LiveImportBar.tsx` : simple libellé « heure de Paris ».
- Aucun changement de schéma, aucune modification du job cron.
