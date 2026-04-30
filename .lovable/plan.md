# Diagnostic : pourquoi l'envoi LIVE n'a pas fonctionné

## Constats

J'ai inspecté l'environnement **LIVE** :

- **`communication_batches`** : aucune ligne. Aucun lot n'a été créé.
- **`email_send_log`** : aucune ligne. Aucun email n'a été enfilé dans la queue.
- **`communication_templates`** : le template "Communication générale - La Bordure" est bien présent (migration manuelle OK).
- **Logs HTTP de `send-communication-email`** :
  - `OPTIONS` → **200** (CORS preflight OK)
  - `POST` → **401 Unauthorized** (893 ms)
- **Logs HTTP de `admin-communication-recipients`** (appelée juste après pour la liste des destinataires) → **200 OK** avec le même token. Donc ton JWT super-admin est valide.

## Cause racine

Le `POST` sur `send-communication-email` est rejeté avec un **401**, mais l'autre fonction admin appelée dans la même session passe en 200. Comme les deux fonctions héritent du même `verify_jwt = true` par défaut et que ton token est bon, le 401 vient **de l'intérieur de la fonction**, pas de la couche Supabase.

En relisant `supabase/functions/send-communication-email/index.ts` :

```ts
const supabaseClient = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_ANON_KEY') ?? '',
  { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
);

const { data: isSuperAdmin, error: superErr } = await supabaseClient.rpc('is_superadmin');
...
const { data: { user } } = await supabaseClient.auth.getUser();
if (!user) {
  return new Response(JSON.stringify({ error: 'Non authentifié' }), { status: 401, ... });
}
```

Le 401 retourné est exactement celui-ci : **`auth.getUser()` n'arrive pas à résoudre l'utilisateur** alors même que le JWT est passé en header. C'est un piège classique : `supabase-js` v2.7.1 (très ancien, importé en dur ligne 2) avec un client construit en mode anon + `Authorization` injecté manuellement n'extrait pas toujours correctement l'utilisateur via `getUser()` sans token explicite.

L'autre fonction `admin-communication-recipients` fonctionne probablement parce qu'elle utilise un schéma d'auth différent (à confirmer en la lisant), ou une version plus récente du SDK.

## Pourquoi ça n'a pas échoué côté UI

`SendCommunicationForm.handleSend` fait :
```ts
const { data, error } = await supabase.functions.invoke(...);
if (error) throw error;
if (data?.error) throw new Error(data.error);
toast.success(...)
```

Avec `supabase.functions.invoke`, un **HTTP 401 avec un body JSON `{ error: "..." }`** ne lève pas toujours `error` côté client (selon la version) — mais surtout le `toast.success` final montre `data.queued` qui est `undefined` → "Envoi en file d'attente : undefined email(s)". Tu as peut-être interprété ça comme un succès. À confirmer côté toi.

## Correctif proposé

Aligner `send-communication-email` sur le pattern qui marche (utilisé par `admin-communication-recipients`) :

1. Mettre à jour la version de `@supabase/supabase-js` (passer de `2.7.1` à `^2.45` comme les autres fonctions du projet).
2. Extraire explicitement le JWT du header `Authorization` et le passer à `auth.getUser(token)` au lieu de s'appuyer sur l'injection automatique.
3. Vérifier le rôle super-admin via une requête directe sur `user_roles` avec le client `service_role` (plus robuste que `rpc('is_superadmin')` qui dépend de `auth.uid()` dans le contexte RLS).
4. Logger l'erreur exacte (cause du 401) pour pouvoir la diagnostiquer si elle se reproduit.

## Étapes

```text
1. Lire supabase/functions/admin-communication-recipients/index.ts
   pour copier son pattern d'auth qui fonctionne en LIVE.

2. Refactorer supabase/functions/send-communication-email/index.ts :
   - SDK supabase-js -> version cohérente avec le reste du projet
   - getUser(token) explicite avec le JWT extrait du header
   - vérification superadmin via service_role + table user_roles
   - logs console.error détaillés sur chaque branche d'échec

3. Déployer la fonction (auto sur sauvegarde côté TEST,
   puis publication par toi pour passer en LIVE).

4. Toi : refaire un envoi test en LIVE (à toi-même uniquement)
   et vérifier l'apparition dans l'onglet Historique.
```

## Détails techniques

- Fonction concernée : `supabase/functions/send-communication-email/index.ts`
- Aucune modification de schéma SQL nécessaire.
- Aucune modification UI nécessaire (mais on peut durcir le toast pour ne pas afficher "succès" si `data.queued` est falsy — à voir en option).
- Les emails que tu pensais avoir envoyés n'ont **jamais** été créés en base ni enfilés dans la queue, donc rien à nettoyer.
