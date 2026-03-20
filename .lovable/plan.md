

## Plan : Bouton Pause/Reprise pour les annonces en direct

### Contexte

Après la clôture d'un round, l'admin publie les annonces une à une. Les managers arrivent en décalé et ratent les premières annonces. Un bouton pause permet à n'importe quel manager de mettre en pause les annonces pour que tout le monde se connecte, puis de relancer.

### Architecture

L'état de pause est stocké en base sur la table `auctions` pour être partagé entre tous les managers en temps réel.

### Modifications

**1. Migration : ajouter colonnes pause sur `auctions`**
- `announcements_paused` (boolean, default false)
- `announcements_paused_by` (uuid, nullable, ref managers)

**2. Edge function `auction-toggle-pause/index.ts`** (nouveau)
- Reçoit `{ auction_id }`, authentifie le manager
- Toggle `announcements_paused` (true↔false) et met à jour `announcements_paused_by`
- Retourne le nouvel état

**3. Edge function `auction-get-live-status/index.ts`** (modifier)
- Inclure `announcements_paused` et le nom du manager qui a pausé dans la réponse

**4. Edge function `publier-annonce/index.ts`** (modifier)
- Vérifier `announcements_paused` avant de publier ; si pausé, retourner une erreur explicite pour bloquer l'admin

**5. Frontend `AuctionLiveAnnouncements.tsx`** (modifier)
- Ajouter un bouton Pause/Play bien visible dans le header
- Quand pausé : bannière pleine largeur "⏸ Annonces en pause — En attente des managers" avec le nom de qui a pausé + bouton "Reprendre"
- Quand actif : petit bouton pause discret
- Utiliser le realtime existant (refetch toutes les 3s) pour propager l'état

**6. Admin `AnnouncementsLive.tsx`** (modifier)
- Désactiver le bouton "Annoncer" quand pausé
- Afficher un message indiquant que les annonces sont en pause par un manager

### UX pause/reprise

- **État pausé** : bannière rose/orange animée en haut du feed avec icône ⏸, texte "Annonces en pause", nom du manager qui a pausé, et bouton "▶ Reprendre les annonces"
- **État actif** : bouton discret "⏸ Pause" à côté du badge de progression
- Tout manager peut pauser ou reprendre (pas besoin d'être celui qui a pausé)

### Fichiers impactés
- Migration SQL (2 colonnes sur `auctions`)
- `supabase/functions/auction-toggle-pause/index.ts` (nouveau)
- `supabase/functions/auction-get-live-status/index.ts`
- `supabase/functions/publier-annonce/index.ts`
- `src/components/auction/v2/AuctionLiveAnnouncements.tsx`
- `src/components/admin/rounds/AnnouncementsLive.tsx`

