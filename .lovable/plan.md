

## Corriger le trigger de calcul automatique des bonus coureur

### Cause racine

Le trigger `trigger_calculate_bonus_rider` utilise un `EXISTS` check basé sur le `commentaire` pour éviter les doublons. Le commentaire ne contient PAS le `etape_numero`. Résultat : quand un coureur marque des points sur 2 étapes différentes d'une même course avec le même type de classement, seule la 1ère étape génère un bonus — les suivantes sont ignorées car le commentaire est identique.

### Correction

**Migration SQL** — Modifier la fonction `trigger_calculate_bonus_rider` :

1. Ajouter `etape_numero` dans le commentaire généré :
   ```
   'Bonus coureur automatique (25%) - ' || course_id || ' - ' || type_classement || ' E' || COALESCE(etape_numero, 0)
   ```

2. Alternativement (plus robuste), changer le check `EXISTS` pour comparer sur les champs structurels plutôt que sur le commentaire texte :
   ```sql
   SELECT EXISTS(
     SELECT 1 FROM bonus_points
     WHERE phase_id = NEW.phase_id
       AND coureur_id = NEW.coureur_id
       AND manager_id = v_manager_rec.manager_id
       AND league_id = v_manager_rec.league_id
       AND bonus_type = 'coureur_bonuse'
       AND commentaire LIKE '%- ' || NEW.course_id || ' - ' || NEW.type_classement || ' E' || COALESCE(NEW.etape_numero::text, 'GC') || '%'
   )
   ```

L'approche recommandée : utiliser une clé composite (course_id + type_classement + etape_numero) dans le commentaire ET dans le EXISTS, alignée avec ce que fait déjà `recalculate-rider-bonuses`.

### Après la migration

Lancer un recalcul via l'edge function `recalculate-rider-bonuses` pour Vlasov (ou pour toute la phase) afin de corriger les bonus manquants existants. La fonction de recalcul est déjà correcte — elle inclut l'étape dans le commentaire.

### Fichier impacté

- **Migration SQL** : `CREATE OR REPLACE FUNCTION trigger_calculate_bonus_rider()` avec le correctif etape_numero dans commentaire + EXISTS check.

