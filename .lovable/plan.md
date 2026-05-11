## Plan : sécuriser `scrape-live-race` (auth superadmin + allowlist d'URL)

### Contexte
La fonction edge `scrape-live-race` n'a aucune vérification d'authentification et fait `fetch(url)` avec une URL fournie par l'appelant. Risques :
- **SSRF** : un attaquant peut viser des endpoints internes (ex. `http://169.254.169.254/...`).
- **Endpoint ouvert** : n'importe qui peut déclencher du scraping arbitraire.

Seul `SuperAdminLiveBroadcastPage` appelle cette fonction (côté admin), donc la restreindre aux superadmins ne casse rien.

### Changements

**1. `supabase/functions/scrape-live-race/index.ts`** — ajouter en tête du handler, après le check OPTIONS :

- Vérifier le header `Authorization`, créer un client Supabase avec ce header, valider le JWT via `getClaims()`.
- Vérifier que l'utilisateur est superadmin via `userClient.rpc('is_superadmin')`. Sinon → 401/403.
- Après parsing du body, valider `url` :
  - `new URL(url)` doit réussir, protocole `http:` ou `https:` uniquement.
  - `hostname` doit appartenir à une allowlist : `procyclingstats.com`, `firstcycling.com`, `lequipe.fr` (et leurs sous-domaines, via `endsWith`).
  - Sinon → 400 `URL not allowed`.

**2. Pas de changement côté client** — `SuperAdminLiveBroadcastPage` est déjà derrière `SuperAdminGuard` et envoie l'`Authorization` automatiquement via `supabase.functions.invoke`.

**3. Pas de changement à `supabase/config.toml`** — la fonction n'y est pas listée, on garde le défaut (`verify_jwt = false` géré par signing-keys ; on valide en code).

### Vérification
- Tester en non-superadmin → 403.
- Tester avec une URL hors allowlist (ex. `http://169.254.169.254`) → 400.
- Tester depuis SuperAdmin Live Broadcast avec une URL PCS → fonctionne.
- Marquer le finding `scrape_live_no_auth` comme résolu.
