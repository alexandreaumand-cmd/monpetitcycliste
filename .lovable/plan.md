

# Fix: team_confirmed non visible — deux problèmes identifiés

## Diagnostic

### Problème 1 : Les données ne sont pas encore remplies
La colonne `team_confirmed` vient d'être ajoutée avec `default false`. Le scraper n'a pas encore re-scrapé les courses pour détecter le statut réel. Il faut **forcer un re-scrape** des courses concernées.

**Action** : Mettre à jour `last_tracker_check` à `null` sur les courses proches (< 14 jours) pour que le tracker les re-scrape au prochain cycle (toutes les 5 min).

```sql
UPDATE courses 
SET last_tracker_check = NULL 
WHERE date_debut >= CURRENT_DATE - INTERVAL '7 days' 
AND date_debut <= CURRENT_DATE + INTERVAL '14 days'
AND pcs_slug IS NOT NULL;
```

### Problème 2 : La vue admin `StartlistDetailView` n'affiche pas le statut

La section "coureurs inscrits" dans la vue admin SuperAdmin (`StartlistDetailView.tsx` → `StartlistRidersManagement`) n'utilise pas `team_confirmed`.

**Fichier modifié** : `src/components/admin/startlist/StartlistRidersManagement.tsx`  
- Ajouter un indicateur ✓ vert à côté des coureurs dont `team_confirmed = true`
- Ajouter un compteur "X/Y équipes confirmées" en haut de la section

### Vérification du parsing PCS
J'ai vérifié le HTML réel de PCS. La structure est :
- Confirmé : `<span class="confirmed ok">`
- Non confirmé : `<span class="confirmed ">`

Le code actuel (`span.confirmed` + `includes("ok")`) est **correct**. Le problème est uniquement que le scraper n'a pas encore tourné avec le nouveau code.

