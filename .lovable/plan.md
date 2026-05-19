## Fonctionnalité : Suivi des blessures coureurs

Scraping quotidien de https://www.procyclingstats.com/statistics/start/latest-injuries, stockage en base, affichage d'un emoji 🤕 dans l'app, page d'administration dédiée.

---

### 1. Base de données

Nouvelle table `rider_injuries` :

| Colonne | Type | Description |
|---|---|---|
| `id` | uuid PK | |
| `coureur_id` | text (FK logique vers `coureurs.id`) | Coureur concerné — uniquement ceux déjà connus en base |
| `rider_name_pcs` | text | Nom tel qu'affiché sur PCS (audit/debug) |
| `injury` | text | Type de blessure (ex. « Fractured collarbone ») |
| `injury_context` | text | « Moment de la blessure » (ex. « Crash in Giro d'Italia \| Stage 2 ») |
| `injury_date` | date | Date de la blessure |
| `weeks_out` | integer | Semaines estimées d'absence |
| `estimated_return_date` | date généré | `injury_date + weeks_out * 7 jours` |
| `source_url` | text | URL PCS source |
| `first_seen_at` / `last_seen_at` | timestamptz | Suivi du scraping |
| `created_at` / `updated_at` | timestamptz | |

- Index unique sur `(coureur_id, injury_date, injury)` pour éviter les doublons à chaque scrape.
- **RLS** : lecture publique (`SELECT true`), écriture réservée aux superadmins via `is_superadmin()` (le scraping côté serveur utilise la service role, qui bypass la RLS).
- Vue (ou simple filtre côté hook) `active_rider_injuries` = `estimated_return_date >= CURRENT_DATE` → c'est cette condition qui détermine si l'emoji s'affiche.

### 2. Edge function `scrape-rider-injuries`

- Fetch HTML brut de la page PCS (pas d'API).
- Parse chaque bloc rider :
  - Nom (ex. `KELDERMAN Wilco`) → normalisation `wilco kelderman` → match sur `coureurs.nom` (LOWER + unaccent).
  - Si aucun match → on ignore (filtre hommes/femmes implicite : les femmes ne sont pas dans `coureurs`).
  - Extraction : contexte (ligne sous le nom), `Injury:`, `Date of injury:`, `Estimated weeks out:`.
- UPSERT dans `rider_injuries` sur la clé `(coureur_id, injury_date, injury)` (met à jour `weeks_out`, `last_seen_at`, etc.).
- Retourne `{ scraped, matched, inserted, updated, skipped }`.
- Sécurité : header `x-cron-secret` (CRON_SECRET déjà configuré) **OU** appel authentifié par un superadmin (pour le bouton manuel).
- `verify_jwt = false` dans `supabase/config.toml`, validation faite en code.

### 3. Cron quotidien 21h

Via `pg_cron` + `pg_net` (insert SQL exécuté en `supabase--insert`, pas migration, car contient l'URL projet + clé) :

```
cron.schedule('scrape-rider-injuries-daily', '0 21 * * *', net.http_post(...))
```

### 4. UI Super Admin

Nouveau lien dans `SuperAdminPage.desktop.tsx` (et `.mobile.tsx`) sous le groupe **Données & Maintenance** : « Blessés » (icône `HeartPulse` ou `Bandage`).

Nouvelle page `src/pages/admin/SuperAdminInjuriesPage.tsx` :
- Bouton **« Scraper maintenant »** → invoque `scrape-rider-injuries` et affiche un toast avec le résumé.
- Tableau triable des blessures **actives** (par défaut) avec : photo/nom, équipe, blessure, contexte, date blessure, semaines, date retour estimée, statut (actif / terminé).
- Toggle pour afficher l'historique complet.
- Permettre suppression manuelle d'une entrée (au cas où PCS soit faux).

### 5. Emoji 🤕 dans l'app

Petit composant `<InjuryBadge coureurId={...} />` :
- Hook `useActiveInjuries()` (un seul fetch global, cache react-query) → renvoie `Map<coureur_id, injury>` des blessures où `estimated_return_date >= today`.
- Affiche 🤕 cliquable → ouvre un `Popover`/`Dialog` avec : blessure, contexte, date de blessure, semaines d'absence, date estimée de retour.
- Insertion dans 3 emplacements :
  1. **Data coureurs** — `src/components/data/RiderResultsPanel.tsx` (à côté du nom du coureur sélectionné, et dans la liste).
  2. **Équipes** — composants de roster (`MyTeam.tsx`, `MyTeam.mobile.tsx`, `LeagueRostersOverviewDialog.tsx`) à côté du nom de chaque coureur.
  3. **Classement top coureurs** — `src/components/rankings/...` (la page « top coureurs » de la ligue), à côté du nom dans la ligne du classement.

Dès que `CURRENT_DATE > estimated_return_date`, la ligne n'est plus renvoyée par le hook → l'emoji disparaît automatiquement sans cron de nettoyage.

### 6. Détails techniques

- Matching nom PCS → `coureurs` : SQL `LOWER(unaccent(nom)) = LOWER(unaccent($1))` ; fallback sur `LIKE '%lastname%'` pour les noms composés (ex. Buitrago Sanchez vs Buitrago). En cas d'ambiguïté on log et on skip.
- Parsing HTML : regex sur les blocs (le markdown ci-dessus montre une structure très répétitive « **Injury:** … **Date of injury:** … **Estimated weeks out:** … ») ; pas besoin de DOM parser lourd.
- Pas de notif push à ce stade (peut être ajouté plus tard).
- i18n : nouvelles clés ajoutées dans `admin.json` et un namespace `injuries.json` pour le composant `InjuryBadge`.

### 7. Livrable

```text
supabase/migrations/<ts>_rider_injuries.sql     # table + RLS + index
supabase/functions/scrape-rider-injuries/       # edge function
src/pages/admin/SuperAdminInjuriesPage.tsx      # page admin
src/components/shared/InjuryBadge.tsx           # emoji + popover
src/hooks/useActiveInjuries.ts                  # hook global
SuperAdminPage.desktop.tsx / .mobile.tsx        # nav + route
RiderResultsPanel / MyTeam(*) / TopRiders(*)    # insertion du badge
+ cron job (via supabase--insert)
```

---

### Questions / hypothèses retenues sans confirmation

- Emoji utilisé : **🤕** (modifiable facilement).
- Heure 21h = **Europe/Paris** (cron en UTC → `0 19 * * *` été / `0 20 * * *` hiver). Je propose `0 19 * * *` (heure d'été, on est en mai) ; on pourra ajuster.
- Les blessures concernant un coureur **inconnu** de notre base (féminines ou hors WT/PCT) sont **ignorées et non stockées**.
- Pas de notification utilisateur lors d'une nouvelle blessure (peut être ajouté en v2).
