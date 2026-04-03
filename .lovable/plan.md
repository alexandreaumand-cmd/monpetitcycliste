

# Email transactionnel : Enchères ouvertes

## Contexte
Le système envoie déjà des **notifications in-app + push** quand un round d'enchères s'ouvre (via `notifyLeagueMembers` dans `_shared/notifications.ts`). Il faut ajouter un **email** en complément.

Le projet a déjà un domaine email configuré (`notify.labordure.app`) et des templates auth (signup, recovery, etc.) avec le branding La Bordure. On va utiliser le système d'email transactionnel intégré de Lovable.

## Plan

### 1. Scaffolder l'infrastructure email transactionnel
- Appeler `email_domain--scaffold_transactional_email` pour créer la fonction d'envoi d'emails transactionnels (`send-transactional-email`)
- Cela met en place le pipeline d'envoi hors auth

### 2. Créer le template email "Auction Opened"
- Fichier : `supabase/functions/_shared/email-templates/auction-opened.tsx`
- Reprendre le style exact des templates existants (header vert forêt `#1B5E3B`, logo, bouton or `#C8963A`, fond crème `#F6F3ED`)
- Contenu bilingue FR/EN :
  - Objet : "Tour {round_number} ouvert — {league_name}"
  - Titre : "Les enchères sont ouvertes !"
  - Corps : nom de la ligue, numéro du round, deadline
  - CTA : "Placer mes mises" → lien vers `/dashboard/encheres?leagueId={league_id}`
  - Footer discret

### 3. Créer la edge function d'envoi
- Fichier : `supabase/functions/send-auction-email/index.ts`
- Accepte `{ league_id, auction_id, round_number, league_name, deadline_at }`
- Récupère les `user_id` des membres de la ligue → récupère leurs emails depuis `auth.users` (via service role)
- Rend le template React Email en HTML
- Envoie via `send-transactional-email` ou directement via l'API email Lovable

### 4. Intégrer dans le flux d'ouverture d'enchères
- Modifier `_shared/notifications.ts` : ajouter un appel à la nouvelle edge function après l'envoi des push notifications
- Cela impactera automatiquement tous les points d'appel existants (`auto-open-scheduled-auctions`, `ouvrir-nouveau-round`, `leagues-join`, etc.)

### Détails techniques
- Template React Email avec `@react-email/components@0.0.22`
- Styles identiques aux templates auth existants (même palette, même structure)
- L'email inclura le nom de la ligue, le numéro du round, et la deadline
- Envoi asynchrone (non-bloquant) pour ne pas ralentir l'ouverture

