## Problème

`scrape-startlist-abandons` exige `pcs_slug` sur la course, alors que la startlist a déjà été importée à partir d'une URL PCS stockée dans `startlist_imports.file_url`. Du coup le Giro (sans slug) est ignoré, alors qu'on a tout ce qu'il faut.

## Correction

Modifier `supabase/functions/scrape-startlist-abandons/index.ts` :

1. **Ne plus filtrer sur `pcs_slug`** dans la requête `courses`. Sélectionner toutes les courses par étapes en cours (`date_debut <= today <= date_fin` et `date_fin > date_debut`).

2. **Source d'URL = `file_url` du dernier `startlist_imports`** de la course. Si présent et qu'il pointe vers `procyclingstats.com/race/...`, on l'utilise directement.

3. **Construction de l'URL de startlist** :
   - Normaliser le `file_url` (retirer un éventuel suffixe `/startlist`, `/overview`, `/route`, etc. pour récupérer la racine `/race/<slug>` ou `/race/<slug>/<year>`).
   - Ajouter `/startlist` à la fin.
   - Exemple : `https://www.procyclingstats.com/race/giro-d-italia` → `https://www.procyclingstats.com/race/giro-d-italia/startlist`.
   - Si le `file_url` contient déjà l'année (`/race/<slug>/2026`), on garde et on ajoute `/startlist`.

4. **Fallback** : si `file_url` est absent mais `pcs_slug` existe, conserver l'ancien comportement (`/race/<slug>/<year>/startlist`). Si ni l'un ni l'autre, skip avec un log.

5. **Bouton manuel** dans `StartlistDetailView.tsx` : aucun changement nécessaire, il appelle la fonction avec `race_id` et bénéficie automatiquement du fallback `file_url`.

## Conséquences

- Le Giro et toute autre course par étapes en cours dont la startlist a été importée depuis PCS seront automatiquement scannés à 19h sans aucune mise à jour manuelle de `pcs_slug`.
- Aucune migration de schéma. Aucun changement UI. Une seule edge function éditée.
