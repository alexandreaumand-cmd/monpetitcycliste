

# Implémentation des Notifications Push PWA

## Contexte Actuel

**État de la base :**
- Table `push_subscriptions` existante avec : `id`, `user_id`, `endpoint`, `p256dh`, `auth`, `created_at`, `updated_at`
- RLS policies déjà configurées (users can view/insert/delete their own)
- Manque : colonne `preferences` pour les préférences par type

**Secrets configurés :** VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT

---

## Étape 1 : Migration Base de Données

Ajouter la colonne `preferences` à la table existante :

```sql
ALTER TABLE public.push_subscriptions 
ADD COLUMN IF NOT EXISTS preferences jsonb 
DEFAULT '{"results": true, "startlists": true, "auctions": true}'::jsonb;

-- Ajouter une policy pour les updates (manquante actuellement)
CREATE POLICY "Users can update their own push subscriptions"
  ON public.push_subscriptions
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
```

---

## Étape 2 : Fichiers à Créer

### 2.1 Service Worker Push (`public/sw-push.js`)

Gestionnaire de notifications push qui sera injecté dans le Service Worker PWA :
- Écoute l'événement `push` pour afficher les notifications système
- Gère le clic pour naviguer vers la bonne page selon le type
- Navigation :
  - `results_added` → `/dashboard/resultats`
  - `startlist_validated` → `/dashboard/startlist`
  - `auction_*` → `/dashboard/encheres?leagueId=...`

### 2.2 Hook Push Notifications (`src/hooks/usePushNotifications.ts`)

Hook React pour gérer l'abonnement et les préférences :

Interface exposée :
| Propriété | Type | Description |
|-----------|------|-------------|
| `isSupported` | boolean | Navigateur compatible |
| `permission` | string | 'granted', 'denied', 'default' |
| `isSubscribed` | boolean | Abonnement actif |
| `preferences` | object | Préférences par type |
| `subscribe()` | function | S'abonner aux push |
| `unsubscribe()` | function | Se désabonner |
| `updatePreferences()` | function | Mettre à jour les préférences |
| `isLoading` | boolean | État de chargement |

### 2.3 Composant UI (`src/components/settings/NotificationSettings.tsx`)

Interface utilisateur avec :
- Switch principal pour activer/désactiver les notifications push
- Switches secondaires pour chaque type (si push activé) :
  - Résultats de course
  - Startlists validées
  - Enchères
- Messages d'état : non supporté, permission refusée, instructions iOS

### 2.4 Edge Function (`supabase/functions/send-push-notification/index.ts`)

Fonction serverless pour envoyer les notifications :

Entrée :
```json
{
  "user_ids": ["uuid1", "uuid2"],
  "title": "Titre",
  "message": "Corps du message",
  "type": "results_added",
  "metadata": { "league_id": "..." }
}
```

Logique :
1. Récupérer les subscriptions des user_ids
2. Filtrer selon le type et les préférences utilisateur
3. Envoyer via Web Push (chiffrement + signature VAPID)
4. Supprimer les subscriptions expirées (404, 410)

---

## Étape 3 : Fichiers à Modifier

### 3.1 vite.config.ts

Ajouter `importScripts` pour charger le SW custom :
```javascript
workbox: {
  importScripts: ['sw-push.js'],
  // ... config existante
}
```

### 3.2 AccountPage.tsx

Ajouter une nouvelle section entre "Sécurité" et "Personnalisation" :
```jsx
<NotificationSettings />
```

### 3.3 _shared/notifications.ts

Ajouter l'appel à `send-push-notification` après la création des notifications in-app :
```typescript
// Après l'insertion des notifications in-app
await sendPushNotifications(userIds, notification);
```

### 3.4 Traductions i18n

Ajouter dans `account.json` (FR et EN) :
- `notifications.title`
- `notifications.description`
- `notifications.enablePush`
- `notifications.types.results`, etc.

---

## Ordre d'Exécution

1. Migration DB (colonne preferences + policy update)
2. Création `public/sw-push.js`
3. Modification `vite.config.ts`
4. Création `src/hooks/usePushNotifications.ts`
5. Création `src/components/settings/NotificationSettings.tsx`
6. Modification `src/pages/AccountPage.tsx`
7. Création `supabase/functions/send-push-notification/index.ts`
8. Modification `supabase/functions/_shared/notifications.ts`
9. Mise à jour traductions i18n

---

## Section Technique

### Protocole Web Push (Edge Function)

L'edge function utilisera la Web Crypto API pour :
1. Importer la clé privée VAPID (format PKCS#8)
2. Générer les headers JWT signés
3. Chiffrer le payload avec les clés du navigateur (p256dh, auth)
4. Envoyer via POST à l'endpoint du navigateur

### Gestion des Erreurs

Les subscriptions retournant ces codes seront supprimées :
- `404` : Subscription non trouvée
- `410` : Subscription expirée

### Sécurité

- Clés VAPID en secrets (non accessibles côté client)
- La clé publique est exposée uniquement pour l'abonnement
- RLS policies protègent les subscriptions par user_id
- Edge function vérifie l'autorisation via service role

