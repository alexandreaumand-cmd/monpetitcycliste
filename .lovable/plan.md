## Problème

Sur mobile, dans l'onglet "Chercher" des enchères, ajouter un coureur fait remonter la liste tout en haut. L'utilisateur doit re-scroller pour reprendre où il en était.

## Cause

Dans `src/components/auction/v2/AuctionPageMobile.tsx`, le `useInfiniteQuery` qui charge les coureurs utilise une `queryKey` qui inclut `context?.my_bids?.map(b => b.coureur_id)`. Dès qu'un coureur est ajouté :

1. `context.my_bids` change (refetch après mutation),
2. La queryKey change → React Query traite ça comme une nouvelle requête,
3. Toutes les pages déjà chargées sont jetées, la liste est rechargée depuis l'offset 0,
4. Le conteneur scrollable (`<div className="flex-1 overflow-y-auto">` ligne 707) revient en haut parce que son contenu a été remplacé.

En plus, le paramètre `exclude_rider_ids` envoyé au backend retire le coureur fraîchement ajouté de la liste, ce qui change l'ordre des items restants.

## Solution

Gérer le filtrage des coureurs déjà enchéris **côté client** plutôt que côté requête, pour que la queryKey reste stable lors d'un ajout/suppression d'enchère.

### Changements dans `AuctionPageMobile.tsx`

1. **Retirer `exclude_rider_ids`** (et la dépendance `context?.my_bids?.map(...)`) de la `queryKey` et du body envoyé à `auction-search-riders`. La queryKey ne dépendra plus que des filtres réels (recherche, équipes, cotes, catégories, courses, tri).

2. **Filtrer côté client** dans le `useMemo` qui aplatit `ridersPages` : exclure les `coureur_id` présents dans `context.my_bids` et dans `context.roster`.

   ```ts
   const excludedIds = useMemo(() => {
     const ids = new Set<string>();
     (context?.my_bids ?? []).forEach((b: any) => ids.add(b.coureur_id));
     (context?.roster ?? []).forEach((r: any) => ids.add(r.coureur_id));
     return ids;
   }, [context?.my_bids, context?.roster]);

   const ridersData = useMemo(() => {
     const items = (ridersPages?.pages ?? []).flatMap(p => p.items ?? []);
     return { items: items.filter((r: any) => !excludedIds.has(r.rider_id)) };
   }, [ridersPages, excludedIds]);
   ```

3. **Aucun changement** dans `RiderResultsList`, le bottom sheet, ou la mutation : le scroll reste préservé naturellement car le DOM du conteneur scrollable n'est plus reconstruit (seuls quelques `<TableRow>` disparaissent au milieu, ce qui ne provoque pas de saut en haut).

### Effets de bord à vérifier

- Pagination : le backend continue de renvoyer les mêmes 100 items par page. Filtrer 1–2 items côté client par page est négligeable et n'altère pas `has_more`.
- Compteur visuel : la liste affichée pourra contenir très légèrement moins d'items qu'avant entre deux fetchs, c'est cohérent.
- Le bouton "Charger plus" continue de fonctionner via `fetchNextPage`.

## Détails techniques

Fichier modifié :
- `src/components/auction/v2/AuctionPageMobile.tsx` (queryKey, body de l'invoke, useMemo `ridersData`)

Fichiers non touchés :
- `RiderResultsList.tsx` : reçoit toujours une liste filtrée prête à afficher.
- L'edge function `auction-search-riders` : on cesse simplement de lui envoyer `exclude_rider_ids`, elle reste compatible.
- La version desktop : pas modifiée (le user n'a signalé le problème que sur mobile).
