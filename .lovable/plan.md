## Diagnostic confirmé

Le message **« Publishing failed » 10–20 s après le clic** + **WebSocket sandbox fermé brutalement (code 1006)** = le conteneur de build Lovable **crashe** (OOM ou timeout) pendant l'étape de packaging. Le code compile localement en 17 s sans erreur, donc la cause n'est pas applicative mais bien le **volume** à traiter par la pipeline :

- **137 edge functions** (3–5× la normale)
- **~16 MB d'assets non optimisés** dans `src/assets` + `public/images`
- **520 migrations**

On va attaquer les deux leviers actionnables.

---

## Étape 1 — Nettoyage des edge functions (137 → ~110)

Suppression ciblée des fonctions **one-shot ou totalement orphelines** (zéro référence dans `src/` et dans les autres fonctions). Trois catégories :

**A. Fonctions one-shot d'import/migration (référencées par UI admin obsolète à supprimer aussi)**
- `admin-import-matt-l-results` + `src/components/admin/import/MattLImportSection.tsx`
- `auction-fix-carried-over-to-draft` (aucune réf UI)

**B. Fonctions orphelines (zéro référence projet)** — à valider une par une avant suppression :
- `admin-cleanup-phantom-course`, `admin-refresh-standings`, `admin-stage-overview`
- `arena-recaps`, `arena-recap-watchdog`
- `compute-phases`, `course-stages`, `courses-filter-options`, `courses-leaderboard-podiums`
- `export-course-leaderboard-csv`, `list-courses-with-results`, `manager-coureur-points-detail`
- `results-course-meta`, `results-course-top`, `results-latest-feed`, `results-recent-races`
- `startlist-export-csv`, `startlist-export-csv-from-text`, `startlist-save-aliases`, `startlist-upload-route-image`
- `leagues-delete`

⚠️ **À NE PAS supprimer** sans vérif : `auth-email-hook` (probable hook auth Supabase), tout ce qui contient `cron`, `watchdog`, `daily`, `nightly` (déclenché par pg_cron, donc invisible côté code).

Pour chaque candidat de la liste B, je vérifierai :
1. Pas de référence dans `pg_cron` (via `supabase--read_query` sur `cron.job`)
2. Pas de référence dans un trigger DB
3. Pas de webhook configuré

Puis suppression via `supabase--delete_edge_functions` + `rm -rf supabase/functions/<nom>`.

**Cible : passer de 137 à ~110 functions.** Gain attendu : -20 % de la charge de packaging.

---

## Étape 2 — Compression des assets (16 MB → ~4 MB)

Les fichiers à traiter (par ordre de gain) :

| Fichier | Taille actuelle | Action | Cible |
|---|---|---|---|
| `public/images/hero-roubaix.avif` | 3.0 MB | déjà des variants 1680/1280/960 — supprimer le master non utilisé | 0 |
| `public/images/hero-roubaix.jpg` | 1.7 MB | idem | 0 |
| `src/assets/hero-peloton-aerial.webp` | 1.8 MB | re-encoder webp q=75 | ~250 KB |
| `src/assets/logo.png` | 1.7 MB | convertir PNG→WebP + redim | ~50 KB |
| `src/assets/hero-handlebar.webp` | 1.3 MB | re-encoder | ~200 KB |
| `src/assets/mpc-logo*.png` (3 fichiers) | 2.3 MB total | convertir en WebP | ~150 KB |
| `src/assets/showcase-results.png` | 343 KB | WebP | ~80 KB |

Vérifier au préalable chaque référence (`rg`) avant de supprimer un master, et mettre à jour les imports si format changé.

**Gain attendu : -12 MB sur le bundle, -50 % sur le precache PWA.**

---

## Étape 3 — Vérification + nouvelle tentative de publication

1. `bunx vite build` local pour confirmer que tout compile
2. Vérifier que `dist/` passe sous **10 MB** (vs 18 MB actuellement)
3. Demander à l'utilisateur de retenter **Publish → Update**

---

## Si Publish échoue toujours après ces étapes

C'est une limite d'infrastructure Lovable Cloud, pas du code. À ce moment-là :
- Rouvrir le ticket support avec le diagnostic complet (137→110 fns, 18 MB→6 MB dist, WS code 1006)
- Demander explicitement un upgrade du tier sandbox de publication (l'instance backend a été passée en `ci_micro` le 6 mai mais le sandbox de build est dimensionné séparément)

---

## Hors-scope volontairement

- **520 migrations** : ne pas y toucher. Risque de casser la chaîne de replay et aucune migration n'est rejouée à la publication (elles sont déjà appliquées à la DB live).
- **Suppression de fonctions douteuses** (auth-email-hook, *-cron-*) : trop risqué sans inventaire pg_cron complet.
- Refactor du code applicatif : non lié au crash.

---

## Détails techniques

```text
Avant                          Après cible
─────────────                  ─────────────
137 edge fns                   ~110 edge fns
18 MB dist                     ~6 MB dist
10.8 MB precache               ~4 MB precache
~16 MB assets bruts            ~4 MB assets bruts
```

Outils utilisés : `supabase--read_query` (pg_cron check), `supabase--delete_edge_functions`, `rm`, `nix run nixpkgs#imagemagick` ou `nix run nixpkgs#libwebp` pour la compression.
