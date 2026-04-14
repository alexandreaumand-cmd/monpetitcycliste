

# Plan : Inclure les championnats dans le mode "World Tour uniquement"

## Problème
Les 4 courses de championnats (World Championships ME - ITT/RR, European Continental Championships ME - ITT/RR) ont des catégories `WC ITT`, `WC RR`, `EC ITT`, `EC RR`. Le filtre SQL actuel pour `wt_only` ne garde que `categorie LIKE '%WT%' OR categorie ILIKE '%Grand Tour%'`, donc ces courses sont exclues.

## Modifications

### 1. Migration SQL — Élargir le filtre `wt_only`
Modifier la fonction `get_league_course_ids` pour que le filtre `wt_only` inclue aussi les catégories `WC%` et `EC%` :
```sql
AND (NOT COALESCE(v_scope.wt_only, false) 
     OR c.categorie LIKE '%WT%' 
     OR c.categorie ILIKE '%Grand Tour%'
     OR c.categorie LIKE 'WC%'
     OR c.categorie LIKE 'EC%')
```
Cela s'applique aux 2 branches de la fonction (avec phases et sans phases).

### 2. UI — Info sous la variante "World Tour uniquement"
Dans `CreateLeagueDialog.tsx` et `LeagueSettingsForm.tsx`, ajouter un texte explicatif sous le radio button "World Tour uniquement" :
> *Inclut également les Championnats du Monde et d'Europe (CLM et route)*

### 3. Traductions
- **FR** `settings.variantWTInfo` : "Inclut également les Championnats du Monde et d'Europe (CLM et route)"
- **EN** `settings.variantWTInfo` : "Also includes World and European Championships (ITT and road race)"

## Fichiers modifiés
1. Nouvelle migration SQL (fonction `get_league_course_ids`)
2. `src/components/leagues/CreateLeagueDialog.tsx`
3. `src/components/leagues/LeagueSettingsForm.tsx`
4. `src/i18n/locales/fr/leagues.json`
5. `src/i18n/locales/en/leagues.json`

