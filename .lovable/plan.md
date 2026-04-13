

# Écran Super-Admin : Suivi des enchères de toutes les ligues

## Problème
En tant que super-admin, vous ne pouvez pas suivre ni clôturer les rounds d'enchères des ligues dont vous n'êtes pas membre, car l'interface admin actuelle (`RoundControlCenter`) dépend d'un contexte de ligue (`useLeague()`) qui n'est pas disponible dans la section super-admin.

Le backend supporte déjà le bypass super-admin dans `clore-round` (ligne 66 : "Superadmin bypass"), donc seul le front-end manque.

## Plan

### 1. Créer le composant `SuperAdminAuctionsMonitor`
**Fichier** : `src/components/admin/auctions/SuperAdminAuctionsMonitor.tsx`

- Requête toutes les auctions avec `statut = 'open'` ou `statut = 'closed'` (annonces non publiées), jointes aux `leagues` (nom) et `phases` (index)
- Affiche une carte par ligue avec enchère active :
  - Nom de la ligue, round number, deadline, statut
  - Nombre de managers ayant validé vs total (appel `auction-get-validation-status` par auction)
  - Bouton **Clôturer le round** (appel direct à `clore-round` avec `auction_id` + `league_id`)
  - Bouton **Publier les annonces** pour les rounds fermés avec annonces en attente
- Auto-refresh toutes les 10s

### 2. Créer la page `SuperAdminAuctionsPage`
**Fichier** : `src/pages/admin/SuperAdminAuctionsPage.tsx`

- Wrapper avec `SuperAdminGuard`
- Contient `SuperAdminAuctionsMonitor`

### 3. Ajouter la route et le lien dans la navigation super-admin
**Fichiers** : `SuperAdminPage.desktop.tsx` et `SuperAdminPage.mobile.tsx`

- Ajouter l'entrée `{ label: "Enchères", path: "auctions", icon: Gavel }` dans le groupe "Ligues & Arène"
- Ajouter la route `<Route path="auctions" element={<SuperAdminAuctionsPage />} />`

### Détails techniques
- Les données des auctions sont lues via `supabase.from('auctions').select('*').in('statut', ['open', 'closed'])` puis enrichies avec les noms de ligues via une requête séparée sur `leagues`
- La clôture appelle `supabase.functions.invoke('clore-round', { body: { auction_id, league_id } })` — le backend détecte le super-admin et switche en service role automatiquement
- Pas de nouveau composant de contexte nécessaire : chaque carte opère avec son propre `league_id`/`auction_id`

