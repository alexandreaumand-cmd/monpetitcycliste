

## Diagnostic : Doublons de bonus coureurs (+25%)

### Problème identifié

Le trigger `trigger_calculate_bonus_rider()` n'a **aucune protection contre les doublons**. À chaque recalcul des points (via l'interface Super Admin), le trigger insère un nouveau bonus au lieu de vérifier s'il existe déjà.

### Preuve dans les données

| Coureur | Commentaire | Créé le 1 | Créé le 2 | Écart |
|---------|------------|-----------|-----------|-------|
| SOBRERO | General | 05:06:53 | 06:53:06 | ~2h |
| BRENNER | General | 05:06:53 | 06:53:06 | ~2h |
| BRENNER | Etape | 06:48:44 | 08:35:50 | ~2h |

Les doublons correspondent à des recalculs de points effectués à différents moments.

### Code défaillant (trigger actif)

```sql
-- trigger_calculate_bonus_rider() - PAS DE VÉRIFICATION
INSERT INTO bonus_points (...) VALUES (...);
```

### Code correct (migration existante mais non utilisée)

```sql
-- calculate_rider_bonus_on_points_insert() - AVEC VÉRIFICATION
IF NOT EXISTS (
  SELECT 1 FROM bonus_points bp
  WHERE bp.phase_id = NEW.phase_id
  AND bp.coureur_id = NEW.coureur_id
  AND bp.manager_id = v_bonus_record.manager_id
  AND bp.league_id = v_bonus_record.league_id
  AND bp.bonus_type = 'coureur_bonuse'
  AND bp.commentaire LIKE '%' || COALESCE(NEW.course_id, 'Course') || ' - ' || NEW.type_classement::text || '%'
) THEN
  INSERT INTO bonus_points ...
END IF;
```

---

## Solution proposée

### Étape 1 : Corriger le trigger

Mettre à jour la fonction `trigger_calculate_bonus_rider()` pour ajouter la vérification `IF NOT EXISTS` :

```sql
CREATE OR REPLACE FUNCTION public.trigger_calculate_bonus_rider()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_bonus_record RECORD;
  v_bonus_amount INTEGER;
  v_saison_id uuid;
  v_cote_initiale NUMERIC;
  v_comment text;
BEGIN
  IF NEW.points <= 0 THEN
    RETURN NEW;
  END IF;

  SELECT p.saison_id INTO v_saison_id
  FROM phases p WHERE p.id = NEW.phase_id;

  FOR v_bonus_record IN
    SELECT 
      r.manager_id,
      r.league_id,
      brs.coureur_id IS NOT NULL AS is_bonus_rider
    FROM rosters r
    LEFT JOIN bonus_rider_selections brs 
      ON brs.manager_id = r.manager_id 
      AND brs.phase_id = r.phase_id 
      AND brs.coureur_id = r.coureur_id
    WHERE r.coureur_id = NEW.coureur_id
      AND r.phase_id = NEW.phase_id
  LOOP
    IF v_bonus_record.is_bonus_rider THEN
      SELECT prix_initial INTO v_cote_initiale
      FROM coureurs_saisons
      WHERE coureur_id = NEW.coureur_id AND saison_id = v_saison_id;
      
      IF v_cote_initiale IS NULL THEN
        SELECT prix_initial INTO v_cote_initiale 
        FROM coureurs WHERE id = NEW.coureur_id;
      END IF;
      
      IF v_cote_initiale IN (10, 20) THEN
        v_bonus_amount := FLOOR(NEW.points * 0.25);
        v_comment := 'Bonus coureur automatique (25%) - ' 
                     || COALESCE(NEW.course_id, 'Course') 
                     || ' - ' || NEW.type_classement::text;
        
        -- NOUVEAU : Vérification anti-doublon
        IF NOT EXISTS (
          SELECT 1 FROM bonus_points bp
          WHERE bp.phase_id = NEW.phase_id
            AND bp.coureur_id = NEW.coureur_id
            AND bp.manager_id = v_bonus_record.manager_id
            AND bp.league_id = v_bonus_record.league_id
            AND bp.bonus_type = 'coureur_bonuse'
            AND bp.commentaire = v_comment
        ) THEN
          INSERT INTO bonus_points (
            phase_id, coureur_id, manager_id, bonus_type, points,
            commentaire, created_by, league_id
          ) VALUES (
            NEW.phase_id, NEW.coureur_id, v_bonus_record.manager_id,
            'coureur_bonuse', v_bonus_amount,
            v_comment,
            v_bonus_record.manager_id,
            v_bonus_record.league_id
          );
        END IF;
      END IF;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;
```

### Étape 2 : Nettoyer les données existantes

Supprimer les doublons en conservant l'entrée la plus ancienne :

```sql
DELETE FROM bonus_points a
USING bonus_points b
WHERE a.id > b.id
  AND a.phase_id = b.phase_id
  AND a.coureur_id = b.coureur_id
  AND a.manager_id = b.manager_id
  AND a.league_id = b.league_id
  AND a.bonus_type = b.bonus_type
  AND a.commentaire = b.commentaire;
```

---

## Résumé des modifications

| Type | Action | Fichier/Table |
|------|--------|---------------|
| DB | Mettre à jour la fonction trigger | `trigger_calculate_bonus_rider()` |
| DB | Supprimer les doublons existants | `bonus_points` |

## Impact

- **Correction immédiate** des doublons pour SOBRERO et BRENNER
- **Prévention future** de la création de doublons lors des recalculs de points
- **Aucun changement de code frontend** nécessaire

