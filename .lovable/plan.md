

## Objectif

Eviter d'envoyer des notifications push (et in-app) lorsqu'un resultat de course ou d'etape est **corrige** (modifie), tout en les envoyant normalement lors de la **premiere saisie**.

## Analyse du probleme

Il y a **deux sources de notifications** a traiter :

1. **Notifications push** (Edge Function `admin-result-save-lot`) : la fonction envoie systematiquement des notifications push apres chaque sauvegarde de resultats de type "Etape" ou "General", sans verifier si c'est une premiere saisie ou une correction.

2. **Notifications in-app** (Trigger PostgreSQL `notify_results_added`) : le trigger se declenche sur chaque `INSERT` dans `race_results`. Comme la fonction `admin_result_save_lot` fait un `DELETE` puis un `INSERT`, le trigger se redeclenche a chaque correction.

## Solution proposee

### 1. Edge Function `admin-result-save-lot`

Avant d'appeler la RPC de sauvegarde, verifier si des resultats existent deja pour ce (course_id, type_classement, etape_numero) via la table `race_result_sets` ou directement `race_results`. Si des resultats existent deja, c'est une correction : on saute l'envoi de notifications push.

```text
Pseudo-code :
1. Verifier si des race_results existent pour (course_id, type_classement, etape_numero)
2. Stocker is_correction = true/false
3. Appeler la RPC admin_result_save_lot (inchange)
4. Si is_correction == false -> envoyer les notifications push
5. Si is_correction == true -> log "Correction, pas de notification"
```

### 2. Trigger PostgreSQL `notify_results_added`

Meme logique : avant de creer la notification in-app, verifier si une notification pour cette meme course/etape/type a deja ete envoyee. On peut verifier l'existence d'une notification precedente dans la table `notifications`.

```text
Pseudo-code dans le trigger :
1. Verifier si une notification 'results_added' existe deja
   pour ce course_id + type_classement + etape_numero (via metadata)
2. Si oui -> RETURN NEW sans inserer de notification
3. Si non -> inserer la notification normalement
```

### 3. Edge Function `admin-stage-save-step`

Ce endpoint ne gere pas de push notifications actuellement, mais il fait aussi un `DELETE` + `INSERT` qui declenche le trigger. La correction du trigger (point 2) couvrira ce cas automatiquement.

## Details techniques

### Fichier 1 : `supabase/functions/admin-result-save-lot/index.ts`

- Ajouter une requete avant l'appel RPC pour verifier l'existence de resultats :
  ```typescript
  const { count } = await supabaseService
    .from('race_results')
    .select('id', { count: 'exact', head: true })
    .eq('course_id', p_course_id)
    .eq('type_classement', p_type_classement)
    .eq('etape_numero', p_etape_numero); // ou .is('etape_numero', null)
  
  const isCorrection = (count || 0) > 0;
  ```
- Entourer tout le bloc d'envoi push (lignes 78-305) d'une condition `if (!isCorrection)`

### Fichier 2 : Migration SQL (nouveau fichier)

- Modifier la fonction `notify_results_added()` pour verifier si une notification in-app a deja ete envoyee pour la meme combinaison course + type + etape :
  ```sql
  -- Verifier si une notification existe deja pour ce resultat
  IF EXISTS (
    SELECT 1 FROM notifications
    WHERE type = 'results_added'
    AND metadata->>'course_id' = NEW.course_id
    AND metadata->>'type_classement' = NEW.type_classement::text
    AND (
      (NEW.etape_numero IS NULL AND (metadata->>'etape_numero') IS NULL)
      OR metadata->>'etape_numero' = NEW.etape_numero::text
    )
    LIMIT 1
  ) THEN
    RETURN NEW; -- Correction, pas de nouvelle notification
  END IF;
  ```

### Fichier 3 : `supabase/functions/admin-import-race-results-csv/index.ts`

- Meme logique que pour `admin-result-save-lot` : verifier si des resultats existent avant d'envoyer les push notifications.

