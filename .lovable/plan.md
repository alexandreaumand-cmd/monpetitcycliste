

## Probleme identifie

Le trigger `trigger_calculate_bonus_rider` (declenche a chaque INSERT dans `points_ledger`) cree des bonus coureurs (+25%) dans **toutes les ligues** ou le manager a le coureur dans son roster, au lieu de ne creer le bonus que dans les ligues ou le coureur a ete **selectionne comme coureur bonus**.

### Cause technique

La jointure entre `rosters` et `bonus_rider_selections` ne filtre pas par `league_id` :

```text
rosters r
INNER JOIN bonus_rider_selections brs
  ON brs.manager_id = r.manager_id
  AND brs.phase_id = r.phase_id
  AND brs.coureur_id = r.coureur_id
  -- MANQUANT : AND brs.league_id = r.league_id
```

Resultat : si Manou a selectionne Nordhagen comme bonus dans "Early Adopters" uniquement, mais a Nordhagen dans son roster pour "MPC 2026" aussi, le trigger cree des bonus dans les DEUX ligues.

### Preuve

- Nordhagen est selectionne comme bonus rider uniquement dans "Early Adopters" (`85d46f9b`)
- Pourtant, des bonus `coureur_bonuse` pour Nordhagen existent dans "MPC 2026" (`b5b46b5e`) avec 8.75 + 28.75 = 37.50 pts en trop

## Correction

### 1. Corriger le trigger `trigger_calculate_bonus_rider`

Ajouter `AND brs.league_id = r.league_id` dans la jointure :

```sql
CREATE OR REPLACE FUNCTION trigger_calculate_bonus_rider()
RETURNS TRIGGER AS $$
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
      AND brs.league_id = r.league_id  -- AJOUT : filtrer par ligue
    WHERE r.coureur_id = NEW.coureur_id
      AND r.phase_id = NEW.phase_id
  LOOP
    -- reste identique ...
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### 2. Nettoyer les donnees existantes en production

Supprimer les bonus coureur qui n'ont pas de selection correspondante dans la bonne ligue. Requete a executer manuellement dans **Cloud View > Run SQL (Live)** :

```sql
DELETE FROM bonus_points bp
WHERE bp.bonus_type = 'coureur_bonuse'
AND NOT EXISTS (
  SELECT 1 FROM bonus_rider_selections brs
  WHERE brs.manager_id = bp.manager_id
    AND brs.phase_id = bp.phase_id
    AND brs.coureur_id = bp.coureur_id
    AND brs.league_id = bp.league_id
);
```

### 3. Deployer la migration

La migration SQL corrige le trigger. Aucun changement de code frontend necessaire puisque les requetes filtrent deja correctement par `league_id`.

