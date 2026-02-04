

# 🐛 Correction : Erreur de contrainte CHECK sur bonus_points

## Problème identifié

L'erreur `"bonus_points_target_check"` se produit lors de l'enregistrement des résultats parce que le **trigger `trigger_calculate_bonus_rider()`** tente d'insérer un bonus avec une valeur non-NULL pour `target_manager_id` alors que la contrainte l'interdit.

### Contrainte actuelle

```sql
CHECK (
  -- Bonus manager (ttt, scoreurs) : target_manager_id requis
  (bonus_type IN ('ttt', 'scoreurs') AND target_manager_id IS NOT NULL AND coureur_id IS NULL AND manager_id IS NULL) 
  OR 
  -- Bonus coureur (first_win, itt) : coureur_id requis, target_manager_id NULL
  (bonus_type IN ('first_win', 'itt') AND coureur_id IS NOT NULL AND target_manager_id IS NULL) 
  OR 
  -- Bonus coureur sélectionné (+25%) : coureur_id + manager_id requis, target_manager_id NULL
  (bonus_type = 'coureur_bonuse' AND coureur_id IS NOT NULL AND manager_id IS NOT NULL AND target_manager_id IS NULL)
)
```

### Code fautif dans le trigger

```sql
INSERT INTO bonus_points (..., target_manager_id, ...) 
VALUES (..., v_manager_rec.manager_id, ...)  -- ❌ Devrait être NULL !
```

La ligne 53 du trigger insère `target_manager_id = v_manager_rec.manager_id` alors que la contrainte exige `target_manager_id IS NULL` pour les bonus de type `coureur_bonuse`.

---

## Solution

Modifier le trigger `trigger_calculate_bonus_rider()` pour ne pas renseigner `target_manager_id` lors de l'insertion d'un bonus `coureur_bonuse`.

### Avant (bug)

```sql
INSERT INTO bonus_points (
  phase_id, coureur_id, manager_id, 
  target_manager_id,  -- ❌ Ne devrait pas être là
  league_id, bonus_type, points, commentaire, created_by
) VALUES (
  NEW.phase_id, NEW.coureur_id, v_manager_rec.manager_id,
  v_manager_rec.manager_id,  -- ❌ Viole la contrainte
  v_manager_rec.league_id, 'coureur_bonuse', ...
);
```

### Après (corrigé)

```sql
INSERT INTO bonus_points (
  phase_id, coureur_id, manager_id, 
  -- target_manager_id omis → NULL par défaut ✅
  league_id, bonus_type, points, commentaire, created_by
) VALUES (
  NEW.phase_id, NEW.coureur_id, v_manager_rec.manager_id,
  v_manager_rec.league_id, 'coureur_bonuse', ...
);
```

---

## Étapes d'implémentation

1. **Créer une migration SQL** qui recrée la fonction `trigger_calculate_bonus_rider()` sans l'insertion de `target_manager_id`

2. **Vérifier les données existantes** pour corriger les enregistrements invalides si nécessaire

---

## Migration SQL à appliquer

```sql
CREATE OR REPLACE FUNCTION public.trigger_calculate_bonus_rider()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_manager_rec RECORD;
  v_bonus_amount NUMERIC(10,2);
  v_comment TEXT;
  v_already_exists BOOLEAN;
BEGIN
  IF NEW.points <= 0 THEN
    RETURN NEW;
  END IF;

  FOR v_manager_rec IN
    SELECT 
      r.manager_id,
      r.league_id,
      brs.phase_id
    FROM rosters r
    INNER JOIN bonus_rider_selections brs 
      ON brs.manager_id = r.manager_id 
      AND brs.phase_id = r.phase_id 
      AND brs.coureur_id = r.coureur_id
    WHERE r.coureur_id = NEW.coureur_id
      AND r.phase_id = NEW.phase_id
  LOOP
    v_bonus_amount := ROUND(NEW.points * 0.25, 2);
    v_comment := 'Bonus coureur automatique (25%) - ' || COALESCE(NEW.course_id, 'Course') || ' - ' || NEW.type_classement::text;
    
    SELECT EXISTS(
      SELECT 1 FROM bonus_points
      WHERE phase_id = NEW.phase_id
        AND coureur_id = NEW.coureur_id
        AND manager_id = v_manager_rec.manager_id
        AND league_id = v_manager_rec.league_id
        AND bonus_type = 'coureur_bonuse'
        AND commentaire = v_comment
    ) INTO v_already_exists;
    
    IF NOT v_already_exists THEN
      -- ✅ Ne pas inclure target_manager_id pour respecter la contrainte
      INSERT INTO bonus_points (
        phase_id,
        coureur_id,
        manager_id,
        league_id,
        bonus_type,
        points,
        commentaire,
        created_by
      ) VALUES (
        NEW.phase_id,
        NEW.coureur_id,
        v_manager_rec.manager_id,
        v_manager_rec.league_id,
        'coureur_bonuse',
        v_bonus_amount,
        v_comment,
        v_manager_rec.manager_id
      );
      
      RAISE NOTICE 'Bonus coureur calculé: % pts pour coureur % manager %', 
        v_bonus_amount, NEW.coureur_id, v_manager_rec.manager_id;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;
```

---

## Résumé

| Élément | Détail |
|---------|--------|
| **Cause** | Le trigger insère `target_manager_id` alors que la contrainte l'interdit pour `coureur_bonuse` |
| **Fichier impacté** | Fonction PostgreSQL `trigger_calculate_bonus_rider()` |
| **Correction** | Retirer `target_manager_id` de l'INSERT dans le trigger |
| **Impact** | Aucun impact fonctionnel, le bonus reste lié au manager via `manager_id` |

