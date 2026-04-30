## Diagnostic (corrigé)

Tu as raison sur le fuseau : **09:45 UTC = 11:45 Paris**, l'heure n'est pas encore passée au moment où tu écris (il est ~9h Paris). Donc l'enchère n'aurait pas dû être ouverte — mais elle aurait dû exister en `scheduled` et apparaître sur la carte. Or elle n'existe pas.

### Cause racine confirmée

Deux systèmes ne communiquent pas :

1. **`phase_auction_schedule`** (alimentée par "Planning enchères" du superadmin) contient bien ta ligne phase 3 → 30/04 09:45 UTC.
2. **`auctions(statut='scheduled')`** (lue par les cartes de ligue et le mécanisme d'ouverture) ne contient **rien** pour les ligues `five_phases`.

Vérifié en TEST :
- Ligues `full_season` (MPC 2026, Early Adopters) : ont déjà des `auctions(scheduled)` pour phases 3/4/5 — créées à la création de la ligue.
- Ligues `five_phases` (TEST Saison entière 3 managers, Ligue Publique WT, Tête dans le guidon) : **aucune `auctions(scheduled)`** pour les phases futures. Le superadmin doit créer chaque enchère manuellement, et "Planning enchères" est aujourd'hui purement décoratif.

À noter : le nom de la ligue "TEST Saison entière 3 managers" est trompeur, son `game_mode` réel est `five_phases`.

---

## Plan d'implémentation (option A1 retenue)

### 1. Migration SQL — synchroniser `phase_auction_schedule` → `auctions`

Créer une fonction Postgres `sync_phase_schedule_to_auctions(p_phase_id uuid)` qui, pour la phase donnée :
- Lit `auction_opens_at` dans `phase_auction_schedule`.
- Pour chaque ligue `active` en `game_mode = 'five_phases'` dont le `league_scopes` couvre la saison de cette phase :
  - Si une `auctions` existe déjà pour `(league_id, phase_id)` → met à jour `opens_at` (et `deadline_at = opens_at + 24h`) tant que `statut = 'scheduled'`. Ne touche pas si déjà `open`/`closed`.
  - Sinon → insère `auctions(league_id, phase_id, round_number=1, statut='scheduled', opens_at=..., deadline_at=opens_at + 24h)`.

Puis trigger `AFTER INSERT OR UPDATE` sur `phase_auction_schedule` qui appelle cette fonction.

### 2. Ouverture automatique à `opens_at`

Vérifier si une edge function/cron existe déjà pour passer `scheduled → open` (les ligues `full_season` doivent déjà avoir ce mécanisme). Si oui, rien à faire de plus. Si non, ajouter un cron `pg_cron` toutes les minutes qui ouvre les `auctions(scheduled)` arrivées à `opens_at`. **À explorer en phase d'implémentation.**

### 3. Rattrapage one-shot pour la phase 3 en TEST

Après création du trigger, exécuter manuellement `sync_phase_schedule_to_auctions('61a9cda5-…')` pour créer rétroactivement les `auctions(scheduled)` dans les ligues `five_phases` actives. Résultat attendu : la carte de "TEST Saison entière 3 managers" (et les autres ligues `five_phases`) affichera "Enchère programmée le 30/04 11:45".

### 4. Frontend

Aucune modification : le hook `useLeagueCardsData` lit déjà les `auctions(scheduled)` futures (correctif posé précédemment).

---

## Points à confirmer avant migration

1. **Durée de l'enchère par défaut** : `deadline_at = opens_at + 24h` — est-ce la bonne valeur ? (les ligues `full_season` actuelles sont aussi à 24h, donc cohérent)
2. **Round number** : toujours `round_number = 1` à la création (les rounds 2/3/4 sont créés ensuite par "clore-round"), correct ?
3. **Si tu modifies une date dans "Planning enchères" après coup**, on met à jour les `auctions(scheduled)` correspondantes. Ok ?
4. **Nouvelles ligues `five_phases` créées plus tard** : elles devront aussi récupérer les dates planifiées. Le trigger sur `phase_auction_schedule` ne couvre pas ce cas — il faudrait un second trigger sur la création de ligue, ou un appel à `sync_*` à la création d'une ligue `five_phases`. À ajouter au plan ?

Une fois que tu confirmes, je lance la migration.