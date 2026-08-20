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
3. **Alias, pas de fusion** : les deux fiches sont conservées. `SHN494` (Aliaksei) reste la fiche 2026, `alexei_shnyrko` garde l'historique 2024/2025. Un alias de nom est ajouté dans `name_aliases` pour relier les deux orthographes, afin que les imports de startlists et de résultats ne recréent pas un nouveau doublon.
4. **Étendre le même traitement aux autres coureurs concernés** : recenser les fiches multiples correspondant au même coureur (même nom normalisé sous deux identifiants, ou variantes d'orthographe/prénom sur la même équipe d'une saison à l'autre) et créer un alias pour chacune. Aucune suppression ni transfert de points. Les doublons repérés sont surtout des variantes d'accents (ex. ÖRKEN / ORKEN, ŽUMER / ZUMER, KOSTAŃSKI / KOSTANSKI) plus des cas de changement de prénom comme SHNYRKO.

## Détails techniques

- Fichier principal : `supabase/functions/auction-search-riders/index.ts` — la requête `from('coureurs_saisons') ... .eq('saison_id', phase.saison_id)` reçoit `.eq('actif', true)`.
- Aucune migration de schéma nécessaire ; les alias sont des insertions de données dans `name_aliases` (aucun changement de structure).
- Aucune fusion, aucune suppression : les rosters, résultats et points historiques rattachés aux anciens identifiants restent intacts.
- Le recensement des doublons s'appuie sur `public.normalize_text(nom)` pour regrouper les fiches équivalentes avant insertion des alias.

