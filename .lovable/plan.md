## Problème

Tu modifies une date dans **Admin → Planning enchères par phase**, mais :

1. **Les cartes de ligue ne bougent pas** parce que la table `phase_auction_schedule` (où tu écris) et la table `auctions` (que lisent les cartes) ne sont pas synchronisées automatiquement. La fonction `sync_phase_schedule_to_auctions()` existe mais elle n'est appelée nulle part — il n'y a pas de trigger attaché, malgré son nom. Il faut donc actuellement la déclencher à la main (ce qu'on avait fait pour MPC 2026 / P4).
2. **Fuseau horaire ambigu** : le champ `<input type="datetime-local">` est interprété par `new Date(dateStr)` dans le fuseau du navigateur de l'admin. Si tu administres depuis Paris ça tombe juste, mais ce n'est garanti nulle part et rien ne le dit dans l'UI. Côté DB, la colonne est en `timestamptz` (UTC).

## Correctifs

### 1. Synchronisation automatique vers `auctions`
- Créer un **trigger** `AFTER INSERT OR UPDATE` sur `phase_auction_schedule` qui appelle `sync_phase_schedule_to_auctions(NEW.phase_id)`.
- Étendre la fonction pour qu'elle :
  - prenne aussi en compte les ligues `pending` (pas seulement `active`), pour que le countdown apparaisse dès la création de la ligue (cas CopaTOUR/P4).
  - mette à jour `opens_at` même si l'enchère est encore `scheduled` mais déjà créée — comportement déjà OK, à confirmer.

Résultat : dès que tu enregistres une nouvelle date dans le planning, toutes les enchères `scheduled` des ligues concernées sont alignées sans aucune action manuelle.

### 2. Forcer le fuseau Paris dans l'admin
- Dans `PhaseAuctionSchedule.tsx` :
  - Convertir la saisie `datetime-local` en UTC **explicitement depuis Europe/Paris** (`date-fns-tz` `fromZonedTime`) avant d'écrire en DB, au lieu de `new Date(dateStr).toISOString()`.
  - Convertir la valeur DB vers Paris pour pré-remplir le champ (`toZonedTime` + `format` `yyyy-MM-dd'T'HH:mm`).
  - Ajouter un petit label « heure de Paris » à côté du champ pour lever toute ambiguïté.

Aucun changement de schéma sur ce volet — uniquement la conversion côté UI.

### 3. Rafraîchissement immédiat côté cartes
- Après le `saveMutation`, invalider la query `['league-cards-data', …]` (en plus de `phase-auction-schedule`) pour que les cartes affichent la nouvelle date sans attendre les 5 min de `staleTime`.

## Détails techniques

- Migration SQL :
  - `CREATE OR REPLACE FUNCTION sync_phase_schedule_to_auctions(...)` modifiée pour inclure `l.status IN ('active','pending')`.
  - `CREATE TRIGGER trg_sync_phase_schedule_to_auctions AFTER INSERT OR UPDATE OF auction_opens_at ON public.phase_auction_schedule FOR EACH ROW EXECUTE FUNCTION ...` (wrapper trigger function qui appelle `sync_phase_schedule_to_auctions(NEW.phase_id)` puis `RETURN NEW`).
- `src/components/admin/PhaseAuctionSchedule.tsx` :
  - `import { fromZonedTime, toZonedTime } from 'date-fns-tz'` (déjà dans les deps).
  - `getScheduleDate` → `format(toZonedTime(existing.auction_opens_at, 'Europe/Paris'), "yyyy-MM-dd'T'HH:mm")`.
  - `saveMutation` → `fromZonedTime(dateStr, 'Europe/Paris').toISOString()`.
  - `queryClient.invalidateQueries({ queryKey: ['league-cards-data'] })` ajouté dans `onSuccess`.
  - Label « (heure de Paris) » sous le champ.

## Hors scope

- Le composant `AuctionCreator` continue d'utiliser l'heure locale du navigateur pour le « lancement rapide » (deadline = now+24h), comportement inchangé.
- Pas de migration des données existantes : `phase_auction_schedule` stocke déjà du `timestamptz`, donc les valeurs déjà saisies par toi depuis Paris restent correctes.
