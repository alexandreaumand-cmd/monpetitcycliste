
# Implémentation des notifications push pour les résultats

## Objectif
Ajouter l'envoi de notifications push PWA quand de nouveaux résultats de course sont ajoutés, en complément des notifications in-app déjà existantes.

## Analyse technique

### Situation actuelle
- Le trigger PostgreSQL `notify_results_added` crée des notifications in-app dans la table `notifications`
- La préférence utilisateur "résultats" existe et est mappée dans l'Edge Function
- **Mais** aucun appel à `send-push-notification` n'est effectué pour les résultats

### Approche recommandée
Utiliser un **trigger PostgreSQL avec `pg_net`** pour appeler l'Edge Function directement depuis la base de données. C'est plus fiable qu'un appel frontend car les résultats sont généralement importés par des processus automatiques/admin.

## Plan d'implémentation

### 1. Créer une migration SQL pour le trigger push

Ajouter une fonction et un trigger qui appellent l'Edge Function `send-push-notification` via `pg_net.http_post` :

```sql
-- Fonction pour envoyer les push notifications quand des résultats sont ajoutés
CREATE OR REPLACE FUNCTION public.send_results_push_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_course_name TEXT;
  v_type_label TEXT;
  v_supabase_url TEXT;
  v_service_key TEXT;
BEGIN
  -- Anti-spam: ne notifier que pour le premier résultat d'un type donné
  IF EXISTS (
    SELECT 1 FROM notifications 
    WHERE type = 'results_added' 
    AND metadata->>'course_id' = NEW.course_id
    AND metadata->>'type_classement' = NEW.type_classement::TEXT
    AND COALESCE((metadata->>'etape_numero')::INTEGER, -1) = COALESCE(NEW.etape_numero, -1)
    AND created_at > NOW() - INTERVAL '1 hour'
    AND created_at < NOW() - INTERVAL '1 second' -- Exclure la notification qu'on vient de créer
  ) THEN
    RETURN NEW;
  END IF;

  -- Récupérer le nom de la course
  SELECT nom INTO v_course_name FROM courses WHERE id = NEW.course_id;
  
  -- Formater le type de classement
  v_type_label := CASE
    WHEN NEW.type_classement = 'Etape' THEN 'Étape ' || COALESCE(NEW.etape_numero::TEXT, '')
    WHEN NEW.type_classement = 'GC' THEN 'Classement Général'
    ELSE NEW.type_classement::TEXT
  END;

  -- Appeler l'Edge Function via pg_net (broadcast à tous les utilisateurs)
  PERFORM net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/send-push-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    ),
    body := jsonb_build_object(
      'broadcast', true,
      'title', '🏁 Nouveaux résultats',
      'message', v_type_label || ' - ' || COALESCE(v_course_name, 'Course'),
      'type', 'results_added',
      'metadata', jsonb_build_object(
        'course_id', NEW.course_id,
        'type_classement', NEW.type_classement::TEXT,
        'etape_numero', NEW.etape_numero
      )
    )
  );
  
  RETURN NEW;
END;
$$;

-- Créer le trigger (après le trigger existant des notifications in-app)
CREATE TRIGGER trigger_send_results_push
  AFTER INSERT ON public.race_results
  FOR EACH ROW
  EXECUTE FUNCTION public.send_results_push_notification();
```

### 2. Alternative plus simple : modifier le trigger existant

Si `pg_net` n'est pas disponible, on peut ajouter l'appel push directement dans le code d'import des résultats (côté admin ou Edge Function d'import), similaire à ce qui est fait pour les startlists.

Chercher où les résultats sont importés/créés et ajouter :

```typescript
// Après l'import des résultats
await supabase.functions.invoke('send-push-notification', {
  body: {
    broadcast: true,
    title: '🏁 Nouveaux résultats',
    message: `${typeLabel} - ${courseName}`,
    type: 'results_added',
    metadata: { course_id, type_classement, etape_numero }
  }
});
```

## Fichiers à modifier

1. **Nouvelle migration SQL** : Créer le trigger `send_results_push_notification`
   - OU identifier le code d'import des résultats et y ajouter l'appel

2. **Aucun changement requis** sur :
   - `send-push-notification/index.ts` (déjà prêt avec `getPreferenceKey`)
   - `usePushNotifications.ts` (préférences déjà gérées)
   - `sw-push.js` (gère déjà `results_added`)

## Résultat attendu
- Les utilisateurs avec les notifications push activées et la préférence "résultats" cochée recevront une notification push quand de nouveaux résultats sont ajoutés
- Anti-spam : une seule notification par course/étape/type de classement par heure
