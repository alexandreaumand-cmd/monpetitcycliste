
# Correction des notifications dupliquées pour les résultats

## Problème identifié

Ludo est dans 3 ligues (Legacy, Early Adopters, MPC 2026). Le système actuel crée une notification **par ligue** où le manager est membre, car le `DISTINCT ON (m.id)` est appliqué à chaque itération de boucle séparément.

## Solution technique

### 1. Refactoriser le trigger `notify_results_added`

Au lieu de boucler sur chaque ligue et insérer des notifications avec `DISTINCT ON`, on doit:
- Collecter d'abord tous les managers uniques concernés
- Puis créer une seule notification par manager (avec la première ligue trouvée dans les metadata)

```sql
CREATE OR REPLACE FUNCTION public.notify_results_added()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_course_nom text;
  v_coureur_nom text;
  v_phase_id uuid;
  v_saison_id uuid;
  v_etape_label text;
  v_points integer;
BEGIN
  -- Filtres existants (position = 1, type = Etape ou General)
  IF NEW.position != 1 THEN RETURN NEW; END IF;
  IF NEW.type_classement::text NOT IN ('Etape', 'General') THEN RETURN NEW; END IF;

  -- Récupérer les infos de la course
  SELECT c.nom, c.phase_id, p.saison_id 
  INTO v_course_nom, v_phase_id, v_saison_id
  FROM courses c
  LEFT JOIN phases p ON p.id = c.phase_id
  WHERE c.id = NEW.course_id;

  -- Récupérer le nom du coureur
  SELECT nom INTO v_coureur_nom FROM coureurs WHERE id = NEW.coureur_id;

  -- Construire le label d'étape
  IF NEW.type_classement::text = 'Etape' AND NEW.etape_numero IS NOT NULL THEN
    v_etape_label := 'Étape ' || NEW.etape_numero;
  ELSIF NEW.type_classement::text = 'General' THEN
    v_etape_label := 'Classement Général';
  ELSE
    v_etape_label := NEW.type_classement::text;
  END IF;

  v_points := NEW.points;

  -- Insérer UNE SEULE notification par manager (première ligue trouvée)
  INSERT INTO notifications (manager_id, type, title, message, metadata)
  SELECT DISTINCT ON (m.id)
    m.id,
    'results_added',
    '🏆 Victoire de ' || v_coureur_nom,
    v_coureur_nom || ' remporte ' || v_etape_label || ' sur ' || v_course_nom || 
      ' (' || COALESCE(v_points::text || ' pts', '0 pts') || ')',
    jsonb_build_object(
      'course_id', NEW.course_id,
      'coureur_id', NEW.coureur_id,
      'type_classement', NEW.type_classement::text,
      'etape_numero', NEW.etape_numero,
      'points', v_points,
      'race_name', COALESCE(v_course_nom, 'la course'),
      'league_id', ls.league_id,
      'league_name', l.name
    )
  FROM league_scopes ls
  JOIN leagues l ON l.id = ls.league_id
  JOIN league_members lm ON lm.league_id = ls.league_id
  JOIN managers m ON m.user_id = lm.user_id
  WHERE l.status = 'active'
    AND ls.season_id = v_saison_id
    AND (ls.phases IS NULL OR array_length(ls.phases, 1) IS NULL OR v_phase_id = ANY(ls.phases))
  ORDER BY m.id, ls.league_id  -- ORDER BY manager puis ligue pour DISTINCT ON
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;
```

### 2. Améliorer les push notifications dans l'import CSV

Le code actuel envoie potentiellement plusieurs push si plusieurs types de classement sont importés. On devrait:
- Limiter à 1 push par course (pas par type de classement)
- Ou au moins ne pas envoyer de push pour les porteurs de maillots (cohérent avec le trigger in-app)

Modification dans `admin-import-race-results-csv/index.ts`:
- Filtrer pour n'envoyer que pour 'Etape' et 'General' (pas les porteurs de maillots)
- Envoyer 1 seul push par course si plusieurs types sont importés

## Résumé des modifications

| Fichier | Changement |
|---------|------------|
| Migration SQL | Refactoriser `notify_results_added` pour dédupliquer globalement par manager |
| `admin-import-race-results-csv/index.ts` | Filtrer les push pour Etape/General uniquement, 1 push max par course |

## Résultat attendu

- **Notifications in-app** : 1 seule notification par manager, quel que soit le nombre de ligues
- **Notifications push** : 1 seule notification par course/type de classement pertinent (Etape ou General)
