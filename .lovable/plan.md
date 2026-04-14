

# Fix : "Ligue inconnue" sur la page Enchères Live super-admin

## Cause racine
La requête `supabase.from("leagues").select(...)` dans `SuperAdminAuctionsMonitor.tsx` est soumise aux politiques RLS. La policy SELECT sur `leagues` exige `visibility = 'public' OR is_league_member(id)`. Quand le super-admin n'est pas membre d'une ligue privée, la requête retourne zéro lignes → "Ligue inconnue".

## Solution
Créer une **edge function `admin-get-leagues-info`** qui utilise le service role pour récupérer les infos des ligues (nom, owner name, owner email) sans restriction RLS. L'appeler depuis le composant à la place de la requête directe.

## Modifications

### 1. Nouvelle edge function `supabase/functions/admin-get-leagues-info/index.ts`
- Accepte `{ league_ids: string[] }` en POST
- Vérifie que l'appelant est super-admin (via `user_roles`)
- Requête avec service role client :
  - `leagues` : `id, name, owner_manager_id`
  - `managers` : `id, nom, email` (pour les owners)
- Retourne un map `{ [league_id]: { name, owner_name, owner_email } }`

### 2. `src/components/admin/auctions/SuperAdminAuctionsMonitor.tsx`
- Remplacer la requête directe `supabase.from("leagues")` (lignes 64-70) par un appel à `supabase.functions.invoke("admin-get-leagues-info", { body: { league_ids } })`
- Ajouter `owner_name` et `owner_email` à l'interface `AuctionWithLeague`
- Afficher sous le nom de la ligue : le nom du créateur et son email en texte secondaire

### 3. Affichage dans les cartes
Sous le `CardTitle` (nom de la ligue), ajouter :
```
Créateur : Jean Dupont (jean@example.com)
```
en `text-xs text-muted-foreground`, pour les sections open et closed.

## Fichiers
1. `supabase/functions/admin-get-leagues-info/index.ts` (nouveau)
2. `src/components/admin/auctions/SuperAdminAuctionsMonitor.tsx` (modifié)

