# Forfait Cessieux — passage de la ligue à 9 et clôture du tour 2

Ligue : **RMC <> La Bordure - Tour AuRA 2026** (`2bcf9a41…`)
Manager : **Cessieux** (`7d4c431c…`, user `c8a5…`)
Auction tour 2 : `0390739f…` (statut `open`, deadline 17:05 UTC)

État actuel de Cessieux dans la ligue :
- 1 coureur déjà gagné au tour 1 (1 roster + 1 annonce)
- 10 bids posés (dont ses ench. tour 2 éventuelles)
- aucun bid posé sur le tour 2 en cours (les 9 autres ont tous bidé)

## Plan

Opération en une seule étape, exécutée côté base via l'outil d'écriture (pas de changement de code/UI). Tout est fait en transaction pour éviter un état incohérent.

1. **Nettoyer le tour 2 de Cessieux** : supprimer ses `bids` sur l'auction `0390739f…` (au cas où il en aurait posé d'ici l'exécution).
2. **Libérer son coureur du tour 1** :
   - supprimer ses `rosters` dans cette ligue (1 ligne) → le coureur redevient disponible pour les futurs tours
   - supprimer l'`annonce` où il est `winning_manager_id` (1 ligne) pour garder l'historique cohérent avec le roster
   - supprimer ses `bids` "won" du tour 1 (sinon le coureur reste "déjà attribué" dans les vues de bids)
3. **Retirer Cessieux de la ligue** : `DELETE FROM league_members` pour user `c8a5…` sur cette ligue.
4. **Réduire la taille de la ligue** : `UPDATE leagues SET max_players = 9, current_player_count = 9` sur la ligue.
5. **Clôturer le tour 2** : appeler l'edge function existante `clore-round` avec `auction_id = 0390739f…` et `league_id` (même logique que le bouton "Clôturer" de l'admin). Ça crée les annonces gagnants/perdants pour les 9 ench. en cours et passe l'auction en `closed`.

## Ce qui n'est pas touché

- Aucun code, aucune UI, aucune migration de schéma.
- Les rosters / bids / annonces des 9 autres managers restent intacts.
- Le tour 1 reste validé pour les 9 restants.
- Les points/bonus déjà attribués (`points_ledger`, `bonus_points`) ne sont pas modifiés — Cessieux n'apparaîtra simplement plus dans les classements de la ligue (filtrés par `league_members`).

## Détails techniques

SQL prévu (exécuté via l'outil `insert`, ordre strict) :

```sql
-- 1. bids tour 2
DELETE FROM bids
 WHERE auction_id = '0390739f-a6bf-4cfb-8b2d-4bc3412fdf24'
   AND manager_id = '7d4c431c-c084-47d0-bfff-e07b28352c41';

-- 2. roster + annonce + bids tour 1 (libération du coureur)
DELETE FROM rosters
 WHERE manager_id = '7d4c431c-c084-47d0-bfff-e07b28352c41'
   AND league_id  = '2bcf9a41-b2a0-41a1-a38e-bb2a38584b67';

DELETE FROM annonces
 WHERE winning_manager_id = '7d4c431c-c084-47d0-bfff-e07b28352c41'
   AND auction_id = 'a5fa16c8-b9ce-49f9-bc92-759f791afd41'; -- tour 1

DELETE FROM bids
 WHERE manager_id = '7d4c431c-c084-47d0-bfff-e07b28352c41'
   AND league_id  = '2bcf9a41-b2a0-41a1-a38e-bb2a38584b67';

-- 3. retrait du membre
DELETE FROM league_members
 WHERE league_id = '2bcf9a41-b2a0-41a1-a38e-bb2a38584b67'
   AND user_id   = 'c8a50674-09f8-46ba-b9c2-d199d1829219';

-- 4. taille de ligue
UPDATE leagues
   SET max_players = 9,
       current_player_count = 9
 WHERE id = '2bcf9a41-b2a0-41a1-a38e-bb2a38584b67';
```

Puis appel de l'edge function `clore-round` :

```ts
supabase.functions.invoke('clore-round', {
  body: {
    auction_id: '0390739f-a6bf-4cfb-8b2d-4bc3412fdf24',
    league_id:  '2bcf9a41-b2a0-41a1-a38e-bb2a38584b67',
  }
});
```

## Points à confirmer avant exécution

- **Le coureur gagné par Cessieux au tour 1** : OK pour le remettre dans la pool (il pourra être remis aux enchères dans un futur tour) ? Alternative : le réattribuer à un autre manager (au prix qu'il a payé) — dans ce cas dis-moi à qui.
- **Compte de Cessieux** : on le retire seulement de cette ligue. Son compte global et ses autres ligues éventuelles ne sont pas touchés. OK ?
