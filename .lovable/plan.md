

## Fix : managers d'autres ligues affichés dans le live MPC 2026

### Cause racine

Deux problèmes distincts :

**1. Scraper Edge Function (`scrape-live-race/index.ts`, ligne 634)** : la requête `rosters` filtre par `phase_id` uniquement, **sans filtre `league_id`**. Résultat : tous les managers de toutes les ligues ayant un roster sur cette phase sont inclus dans `rosterMap`. "Nuno Silva" est manager dans une autre ligue mais pas dans MPC 2026.

**2. Broadcast SuperAdmin (`SuperAdminLiveBroadcastPage.tsx`, `enrichText`)** : les noms de managers issus du scraper sont **intégrés directement dans le texte** des messages (`"Stuyven (Nuno Silva)"`). Ce texte est ensuite diffusé à toutes les ligues. Impossible de corriger côté client puisque le nom est "baked in".

### Solution

**Ne plus enrichir le texte des messages broadcast avec les noms de managers.**

Chaque ligue affiche déjà les noms de managers côté client via `useLeagueRosterOwners` (filtré par `league_id`). L'enrichissement côté serveur est redondant et incorrect car cross-ligue.

#### Fichier 1 : `src/pages/admin/SuperAdminLiveBroadcastPage.tsx`

- Supprimer la construction de `riderToManager` et la fonction `enrichText` (lignes ~261-349)
- Remplacer les appels `enrichText(evt.title)` et `enrichText(evt.text)` par les valeurs brutes `evt.title` et `evt.text`
- Garder `matchedRiders` et `scrapeStats` pour l'affichage dans l'éditeur SuperAdmin (indicateurs de matching)

#### Fichier 2 : `supabase/functions/scrape-live-race/index.ts`

- Supprimer le filtre roster (lignes 629-641) et le champ `manager_name` du résultat de `matchRiders`
- Ou plus simplement : garder le matching pour les stats mais ne plus retourner `manager_name` dans la réponse
- Alternative minimale : ne rien changer côté edge function, juste ignorer `manager_name` côté frontend

#### Approche recommandée (changement minimal)

Modifier uniquement `SuperAdminLiveBroadcastPage.tsx` :
- Supprimer `enrichText` et `riderToManager`
- Broadcaster le texte brut des événements (sans noms de managers)
- Le client de chaque ligue résoudra les noms via `useLeagueRosterOwners` qui filtre correctement par `league_id`

### Fichier impacté
- `src/pages/admin/SuperAdminLiveBroadcastPage.tsx` — suppression de `enrichText` / `riderToManager`

