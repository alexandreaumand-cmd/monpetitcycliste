

## Diagnostic

L'erreur `ON CONFLICT DO UPDATE command cannot affect row a second time` est causée par **4 entrées dupliquées dans `race_result_sets`** pour `ename_samyn_classic` (type `General`, `etape_numero = NULL`). La jointure LEFT JOIN dans `admin_compute_points_for_course` multiplie chaque coureur par 4, créant des doublons dans l'INSERT qui échoue.

## Cause racine

La table `race_result_sets` n'a pas de contrainte d'unicité sur `(course_id, type_classement, etape_numero)`, et le flux de saisie crée un nouveau `race_result_set` à chaque sauvegarde sans supprimer les précédents.

## Plan de correction

### 1. Action immédiate — Nettoyer les doublons en production
Migration SQL pour supprimer les `race_result_sets` dupliqués (garder le plus récent) :
```sql
DELETE FROM race_result_sets
WHERE id NOT IN (
  SELECT DISTINCT ON (course_id, type_classement, COALESCE(etape_numero, -1))
    id
  FROM race_result_sets
  ORDER BY course_id, type_classement, COALESCE(etape_numero, -1), created_at DESC
);
```

### 2. Migration — Ajouter une contrainte d'unicité
Ajouter un index unique sur `race_result_sets(course_id, type_classement, COALESCE(etape_numero, -1))` pour empêcher les doublons futurs.

### 3. Corriger `admin_compute_points_for_course`
Ajouter un `DISTINCT` ou `LIMIT 1` dans la sous-requête qui joint `race_result_sets` pour rendre la fonction résistante aux doublons même sans la contrainte.

### 4. Corriger le flux de saisie des résultats
Dans le code qui insère les `race_result_sets`, utiliser un **UPSERT** (`ON CONFLICT DO UPDATE`) au lieu d'un simple INSERT, pour éviter de créer des doublons.

### Fichiers impactés
- Migration SQL (nettoyage + contrainte unique)
- Fonction DB `admin_compute_points_for_course` (ajout DISTINCT sur le LEFT JOIN)
- `src/components/admin/ResultsEntryStudio.desktop.tsx` ou le hook de sauvegarde des résultats (upsert race_result_sets)

