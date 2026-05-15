## Trois problèmes à corriger dans `scrape-startlist-abandons`

### 1. Priorité d'URL inversée
Aujourd'hui la fonction utilise `file_url` en priorité. Or les `file_url` historiques contiennent parfois :
- d'anciens slugs PCS avec underscores (`tour_de_hongrie`) qui retournent maintenant **500**,
- des slugs d'archive avec hash (`giro-d-italia-mj6wbnif`) qui ne sont plus servis.

→ **Inverser la priorité** : utiliser `pcs_slug + year + /startlist` quand `pcs_slug` existe, et seulement retomber sur `file_url` (normalisé : `_`→`-`) quand il manque.

### 2. User-Agent bloqué par Cloudflare
`Mozilla/5.0 (compatible; LabordureBot/1.0)` → **403**.
→ Utiliser un UA Chrome complet :
`Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36`
+ headers `Accept: text/html…` et `Accept-Language: en-US,en;q=0.9`.

### 3. `pcs_slug` manquant pour le Giro
La course `giro-d-italia-mj6wbnif` n'a pas de `pcs_slug`. Le bon est `giro-d-italia`.
→ **Migration** : `UPDATE courses SET pcs_slug='giro-d-italia' WHERE id='giro-d-italia-mj6wbnif';`

## Validation post-correction
- `…/tour-de-hongrie/2026/startlist` → testé HTTP 200
- `…/giro-d-italia/2026/startlist` → testé HTTP 200

## Fichiers touchés
- `supabase/functions/scrape-startlist-abandons/index.ts` (priorité URL + UA)
- nouvelle migration courte pour le slug du Giro
