## Objectif

Pour chaque course par étapes en cours, relire automatiquement la startlist PCS une fois par jour à 19h (Europe/Paris) afin de détecter les coureurs marqués `(DNF #n)` ou `(DNS #n)`, puis afficher cette info sur les startlists côté ligues (badge `DNF 1`, `DNS 2`, etc.).

## Étapes

### 1. Schéma BDD (migration)

Ajouter sur `startlist_entries` :
- `abandon_type text` — `'DNF'` | `'DNS'` | `null`
- `abandon_etape int` — numéro de l'étape où l'abandon est survenu
- `abandon_checked_at timestamptz` — dernier passage du job

Index partiel sur `abandon_type IS NOT NULL` pour filtrage rapide.

### 2. Nouvelle edge function `scrape-startlist-abandons`

Comportement :
1. Sélectionner les courses où `date_debut <= now() <= date_fin` ET `date_fin > date_debut` (= course par étapes en cours), avec `pcs_slug` non null et un `startlist_imports` existant (le plus récent par course).
2. Pour chacune, fetch `https://www.procyclingstats.com/race/<pcs_slug>/startlist` (HTML).
3. Parser chaque ligne coureur : récupérer le dossard (bib) et la mention `(DNF #N)` / `(DNS #N)` accolée au nom (regex sur le nœud `<li>` de la startlist).
4. Pour chaque match, faire correspondre au `startlist_entries` du dernier import de la course via `bib_no` (fallback : nom). Mettre à jour `abandon_type`, `abandon_etape`, `abandon_checked_at`. Réinitialiser à `null` si la mention disparaît (rare mais possible).
5. Logguer un résumé par course (X DNF, Y DNS détectés).

Pas d'auth requise côté front : `verify_jwt = false` dans `supabase/config.toml` (function appelée uniquement par cron).

### 3. Planification cron quotidienne

Via `supabase--insert` (pas migration) :
```sql
select cron.schedule(
  'scrape-startlist-abandons-daily',
  '0 18 * * *',  -- 18:00 UTC = 19:00 Paris en hiver / 20:00 en été
  $$ select net.http_post(
       url:='https://<ref>.supabase.co/functions/v1/scrape-startlist-abandons',
       headers:='{"Content-Type":"application/json","apikey":"<anon>"}'::jsonb,
       body:='{}'::jsonb
     ); $$
);
```
Note : pg_cron tourne en UTC. Pour avoir exactement 19h Paris toute l'année, planifier deux entrées (`0 18` hiver, `0 17` été) — ou plus simple : un seul cron à `0 17 * * *` (=19h en été, 18h en hiver) puisque la saison cycliste majeure (Giro/Tour/Vuelta) tombe en horaire d'été. **Choix recommandé : `0 17 * * *` (été) avec note pour ajustement hiver.** Validation à confirmer avec l'utilisateur si besoin.

### 4. Côté backend lecture

`supabase/functions/startlist-manager-view/index.ts` :
- Ajouter `abandon_type, abandon_etape` au select `startlist_entries`.
- Propager ces champs dans les objets `starters` (mode SuperAdmin) et `managers[].starters` (mode ligue).

### 5. Affichage UI

Badge compact à droite du nom du coureur, rouge pour DNF, gris pour DNS :
- `StartlistDesktopExport.tsx` (export image + vue desktop)
- Vue mobile startlist (`Startlist.mobile.tsx` et composants enfants affichant les coureurs des managers)
- `StartlistRidersManagement.tsx` (affichage SuperAdmin) — lecture seule du badge

Format : `DNF 4` / `DNS 2` (texte court, `Badge` shadcn variant `destructive` pour DNF, `secondary` pour DNS).

### 6. Déclenchement manuel (bonus utile)

Bouton « Vérifier abandons PCS » dans `StartlistDetailView.tsx` (SuperAdmin uniquement) qui invoque la même edge function avec un `race_id` ciblé pour rafraîchir à la demande sans attendre 19h.

## Détails techniques

**Regex parsing PCS** : la startlist PCS rend chaque coureur dans un `<li>` contenant le bib, le drapeau, puis `<a>NOM Prénom</a>` suivi éventuellement de ` (DNF #4)` ou ` (DNS #2)` en texte grisé. Regex de capture : `/\((DNF|DNS)\s*#?\s*(\d+)\)/i` appliquée sur le `textContent` du `<li>`. Bib extrait via le premier `<td>`/span numérique du bloc équipe.

**Matching** : préférer le bib (`startlist_entries.bib_no`) qui est unique par course. Si bib absent côté entry, fallback sur normalisation du nom.

**Idempotence** : la fonction peut tourner plusieurs fois par jour sans effet de bord ; un `UPDATE … WHERE` suffit.

**Sécurité RLS** : la fonction utilise `SUPABASE_SERVICE_ROLE_KEY` donc bypass RLS. Aucune nouvelle policy nécessaire (les colonnes ajoutées héritent du SELECT public existant).

## Fichiers touchés

- `supabase/migrations/<timestamp>_startlist_abandons.sql` (nouvelle)
- `supabase/functions/scrape-startlist-abandons/index.ts` (nouvelle)
- `supabase/config.toml` (verify_jwt = false pour la nouvelle fn)
- `supabase/functions/startlist-manager-view/index.ts` (ajout champs)
- `src/components/startlist/StartlistDesktopExport.tsx` (badge)
- `src/pages/Startlist.mobile.tsx` + composants enfants concernés (badge)
- `src/components/admin/startlist/StartlistRidersManagement.tsx` (badge lecture seule)
- `src/components/admin/StartlistDetailView.tsx` (bouton manuel)
- `cron.schedule` via `supabase--insert` (post-déploiement)
