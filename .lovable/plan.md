# Doublon SHNYRKO visible en enchères

## Ce que montre la base

Il existe **deux fiches coureur distinctes** pour le même homme :

- `alexei_shnyrko` — "Alexei SHNYRKO" : saisons 2024, 2025 et **aussi 2026** (ligne 2026 marquée inactive)
- `SHN494` — "Aliaksei SHNYRKO" : saison 2026 (active)

Donc les deux apparaissent bien dans la saison 2026 de la ligue. Ce n'est pas un problème de saison : c'est un problème de **doublon de fiche** + un filtre manquant.

## Cause du bug

La fonction de recherche des coureurs pendant un tour d'enchères (`auction-search-riders`) filtre uniquement sur `saison_id`, **sans jamais filtrer sur `actif = true`**. Les lignes de saison désactivées côté admin restent donc proposées aux enchères.

Au total 7 coureurs inactifs de la saison 2026 remontent aujourd'hui à tort dans les enchères (dont Alexei SHNYRKO, Simon YATES, Hjalmar KLYVER, Hodei MUNOZ, Nicolò ARRIGHETTI, Tomas PRIDAL, Nikiforos ARVANITOU).

## Correction proposée

1. **Filtrer les coureurs inactifs dans les enchères** : ajouter `actif = true` à la requête de `auction-search-riders`. Effet immédiat : les 7 coureurs désactivés de 2026 disparaissent des tours d'enchères, dont l'ancien "Alexei SHNYRKO".
2. **Vérifier les autres surfaces d'enchères** (`auction-get-context`, `auction-get-live-status`, `auction-upsert-bid`, `auction-submit-all-bids`) et appliquer le même filtre `actif` là où des coureurs sont listés ou validés, pour qu'un coureur désactivé ne puisse pas non plus être misé via les favoris.
3. **Traiter le doublon de fiche** : conserver `SHN494` (Aliaksei, orthographe 2026) comme fiche de référence pour 2026 et laisser `alexei_shnyrko` porter l'historique 2024/2025. Ajouter un alias de nom (table `name_aliases`) reliant les deux orthographes afin que les imports de startlists et de résultats ne recréent pas de doublon.

## Détails techniques

- Fichier principal : `supabase/functions/auction-search-riders/index.ts` — la requête `from('coureurs_saisons') ... .eq('saison_id', phase.saison_id)` reçoit `.eq('actif', true)`.
- Aucune migration de schéma nécessaire pour l'étape 1 ; l'étape 3 est une insertion de données dans `name_aliases` (aucun changement de structure).
- Aucune fusion destructive des rosters/résultats existants : les points historiques rattachés à `alexei_shnyrko` restent intacts.

## Point à confirmer

Faut-il aussi **fusionner définitivement** les deux fiches (transférer l'historique 2024/2025 sous `SHN494` et supprimer `alexei_shnyrko`), ou garder les deux fiches avec un simple alias ? La fusion rend la fiche coureur unique dans les statistiques mais touche l'historique de points.
