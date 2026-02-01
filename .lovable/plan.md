
# Plan : Gestion du bonus "Coureur +25%" avec 2 décimales

## Contexte
Le bonus de +25% pour les coureurs est actuellement stocké et calculé en **nombre entier** (INTEGER). Avec l'introduction des points TTT à précision décimale (NUMERIC(10,2)), le calcul du bonus perd en précision car `FLOOR()` tronque les décimales.

**Exemple** : Un coureur marque 14.29 pts en TTT → Le bonus devrait être 3.57 pts (+25%), mais actuellement c'est 3 pts (FLOOR).

---

## Modifications à effectuer

### 1. Migration de la base de données

**Modifier la colonne `bonus_points.points`** de INTEGER vers NUMERIC(10,2) :

```sql
ALTER TABLE bonus_points 
ALTER COLUMN points TYPE NUMERIC(10,2);
```

### 2. Mise à jour du trigger de calcul automatique

**Modifier la fonction `trigger_calculate_bonus_rider()`** :
- Changer la variable `v_bonus_amount` de INTEGER à NUMERIC(10,2)
- Remplacer `FLOOR(NEW.points * 0.25)` par `ROUND(NEW.points * 0.25, 2)`

```sql
CREATE OR REPLACE FUNCTION public.trigger_calculate_bonus_rider()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_bonus_record RECORD;
  v_bonus_amount NUMERIC(10,2);  -- Changé de INTEGER
  v_saison_id uuid;
  v_cote_initiale NUMERIC;
  v_comment text;
BEGIN
  -- ... (logique existante) ...
  
  -- Calcul avec 2 décimales
  v_bonus_amount := ROUND(NEW.points * 0.25, 2);
  
  -- ... (reste de la logique) ...
END;
$$;
```

### 3. Adaptation de l'affichage (Optionnel)

Pour maintenir la cohérence avec le style UI actuel (points affichés en entiers), l'affichage dans `ManagerBreakdown.tsx` applique déjà `Math.round()` sur les totaux. Les bonus individuels peuvent être affichés avec décimales ou arrondis selon la préférence.

**Option A** : Garder l'affichage avec décimales pour les bonus individuels (précision maximale)
**Option B** : Arrondir tous les bonus à l'affichage (cohérence visuelle)

---

## Résumé des fichiers impactés

| Composant | Modification |
|-----------|--------------|
| Migration SQL | Altérer `bonus_points.points` → NUMERIC(10,2) |
| Trigger SQL | `trigger_calculate_bonus_rider()` avec ROUND(x, 2) |
| UI (optionnel) | `ManagerBreakdown.tsx` - format décimal si souhaité |

---

## Section technique

### Données existantes
Les bonus déjà stockés (ex: 3 pts) resteront valides car NUMERIC(10,2) accepte les entiers. Les nouveaux bonus seront calculés avec précision décimale.

### Compatibilité
- La colonne TypeScript `points` dans les types Supabase sera mise à jour automatiquement
- Les agrégations `SUM()` et `reduce()` fonctionnent de la même manière avec NUMERIC

### Risques
Aucun risque majeur - la modification est rétrocompatible. Les données existantes seront conservées.
