# Fix scraper PCS + afficher les coureurs ignorés

## Diagnostic

La page `latest-injuries` de PCS est une **table plate**, pas une fiche avec labels :
```html
<tr><td>{flag}</td><td>YYYY-MM-DD</td><td><a href="rider/slug">NOM Prénom</a></td><td>{blessure}</td><td>{semaines}</td></tr>
```
Le parser actuel cherche `Injury:`, `Date of injury:`, `Estimated weeks out:` qui n'existent que sur la **page détail** d'un coureur. Résultat : ~5 lignes passent par hasard, ~50 sont silencieusement ignorées (dont Sweeny, Hirschi, Vine, Soler, Moschetti, Withen Philipsen). Buitrago est listé `BUITRAGO Santiago` mais avec le slug `santiago-buitrago-sanchez` — le matching par nom normalisé fonctionnera quand même.

## Correctifs

### 1. `supabase/functions/scrape-rider-injuries/index.ts`

Réécrire `parseInjuries` pour parcourir la table :
- Une seule regex qui capture pour chaque coureur : la `<td>` de date qui précède immédiatement le lien `rider/{slug}`, le nom du coureur, la `<td>` qui suit (blessure), puis la `<td>` suivante (semaines).
- Tolérer attributs HTML variables (`class="mb_w80"`, espaces, etc.).
- Filtrer les anciennes entrées : si `date + semaines * 7 < aujourd'hui`, on ignore (déjà revenu).
- Ne plus tenter d'extraire `injury_context` — la liste PCS ne le fournit pas. La colonne reste vide (nullable).
- Retourner aussi `skipped_details: [{ name, slug, reason }]` (raison : "non trouvé dans la base", "blessure terminée", "données incomplètes").

### 2. `src/pages/admin/SuperAdminInjuriesPage.tsx`

- Stocker le résultat du scraping dans un `useState` (`lastRun`).
- Ajouter sous le bouton "Scraper maintenant" une **Card** "Derniers coureurs ignorés" listant `skipped_details` (nom PCS, slug, raison). Visible seulement si `lastRun` existe.
- Garder le toast existant.

### 3. Hook `useActiveInjuries.ts`

Pas de changement — déjà filtré par `estimated_return_date >= today`.

## Vérification

Après déploiement, "Scraper maintenant" doit :
- trouver ~30+ blessures actives
- enregistrer tous les coureurs présents en base (Sweeny, Hirschi, Vine, Soler, Moschetti, Buitrago, Withen Philipsen inclus)
- afficher dans la nouvelle section la liste des coureurs ignorés (femmes hors base, jeunes équipes, etc.) avec la raison
