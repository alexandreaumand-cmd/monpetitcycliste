
# Implementation des Notifications Push (Web Push API)

## Objectif

Ajouter la capacite d'envoyer des notifications natives (banniere systeme) aux utilisateurs de la PWA, en complement du systeme de notifications in-app existant.

---

## Architecture proposee

```text
+------------------+     +---------------------+     +------------------+
|   Frontend       |     |   Supabase          |     |   Push Service   |
|   (React)        |     |   (Backend)         |     |   (FCM/APNS)     |
+------------------+     +---------------------+     +------------------+
        |                         |                         |
        |  1. Demander permission |                         |
        |------------------------>|                         |
        |                         |                         |
        |  2. Obtenir subscription|                         |
        |<------------------------|                         |
        |                         |                         |
        |  3. Enregistrer sub     |                         |
        |------------------------>|                         |
        |         [push_subscriptions table]                |
        |                         |                         |
        |                         |  4. Envoyer notification|
        |                         |------------------------>|
        |                         |                         |
        |  5. Recevoir push       |                         |
        |<--------------------------------------------------|
        |                         |                         |
        |  [Service Worker]       |                         |
        |  affiche notification   |                         |
+------------------+     +---------------------+     +------------------+
```

---

## Composants a creer/modifier

### 1. Base de donnees - Table `push_subscriptions`

Nouvelle table pour stocker les abonnements push de chaque utilisateur/appareil.

```sql
CREATE TABLE public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, endpoint)
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Politique: les utilisateurs ne peuvent gerer que leurs propres subscriptions
CREATE POLICY "Users can manage their own subscriptions"
  ON public.push_subscriptions
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
```

### 2. Secrets - Cles VAPID

Les cles VAPID (Voluntary Application Server Identification) sont necessaires pour identifier le serveur aupres des services push.

Secrets a configurer :
- `VAPID_PUBLIC_KEY` : Cle publique (partagee avec le frontend)
- `VAPID_PRIVATE_KEY` : Cle privee (serveur uniquement)
- `VAPID_SUBJECT` : Email ou URL du responsable (ex: `mailto:contact@monpetitcycliste.com`)

Note : Je demanderai la generation de ces cles lors de l'implementation.

### 3. Hook Frontend - `usePushNotifications.ts`

Nouveau fichier : `src/hooks/usePushNotifications.ts`

Fonctionnalites :
- Verifier si les notifications push sont supportees
- Demander la permission a l'utilisateur
- S'abonner aux notifications push via le Service Worker
- Enregistrer/supprimer l'abonnement en base de donnees
- Detecter l'etat actuel (permission accordee, abonne, etc.)

```text
Interface retournee :
{
  isSupported: boolean          // Navigateur compatible
  permission: NotificationPermission  // 'granted', 'denied', 'default'
  isSubscribed: boolean         // Abonnement actif
  subscribe: () => Promise      // S'abonner
  unsubscribe: () => Promise    // Se desabonner
  isLoading: boolean
}
```

### 4. Configuration PWA - Service Worker personnalise

Modification de `vite.config.ts` pour injecter un Service Worker custom qui gere les evenements `push` et `notificationclick`.

Fichier custom SW : `public/sw-push.js`

```javascript
// Ecouter les notifications push
self.addEventListener('push', (event) => {
  const data = event.data?.json() || {};
  const title = data.title || 'Mon Petit Cycliste';
  const options = {
    body: data.message,
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    data: data.metadata
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// Gerer le clic sur la notification
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/dashboard';
  event.waitUntil(clients.openWindow(url));
});
```

### 5. Edge Function - `send-push-notification`

Nouvelle fonction : `supabase/functions/send-push-notification/index.ts`

Responsabilites :
- Recevoir le payload de notification (titre, message, metadata)
- Recuperer les subscriptions push des destinataires
- Envoyer les notifications via le protocole Web Push
- Gerer les erreurs (subscriptions expirees, etc.)

Utilisation de la librairie `web-push` compatible Deno.

### 6. Integration avec les notifications existantes

Modifier le trigger `notify_results_added` et la fonction `notifyLeagueMembers` pour :
1. Creer la notification in-app (comme actuellement)
2. Appeler `send-push-notification` pour envoyer la notification push

Options :
- Declenchement via trigger PostgreSQL (appel HTTP vers edge function)
- Ou appel direct depuis les edge functions existantes

### 7. UI - Parametres de notification

Nouveau composant ou section dans les parametres utilisateur pour :
- Activer/desactiver les notifications push
- Afficher l'etat actuel (permission, abonnement)
- Bouton pour se (des)abonner

Emplacement suggere : Page de profil ou parametres du dashboard.

---

## Fichiers a creer

| Fichier | Description |
|---------|-------------|
| `src/hooks/usePushNotifications.ts` | Hook pour gerer les subscriptions push |
| `public/sw-push.js` | Service Worker custom pour recevoir les push |
| `supabase/functions/send-push-notification/index.ts` | Edge function pour envoyer les push |
| `src/components/settings/NotificationSettings.tsx` | UI pour gerer les preferences |

## Fichiers a modifier

| Fichier | Modification |
|---------|--------------|
| `vite.config.ts` | Configurer l'import du SW custom |
| `supabase/functions/_shared/notifications.ts` | Ajouter appel push apres notification in-app |
| Migration SQL | Creer table `push_subscriptions` |

---

## Details techniques

### Generation des cles VAPID

Les cles peuvent etre generees via :
```bash
npx web-push generate-vapid-keys
```

Resultat exemple :
```
Public Key: BLxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
Private Key: yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy
```

### Protocole Web Push

Le serveur envoie une requete HTTP POST au endpoint fourni par le navigateur, avec :
- Headers d'autorisation VAPID
- Payload chiffre avec les cles p256dh et auth

### Compatibilite iOS

- iOS 16.4+ supporte les notifications push pour les PWA
- L'app doit etre installee sur l'ecran d'accueil
- L'utilisateur doit accorder explicitement la permission

### Gestion des erreurs

- `410 Gone` : Subscription expiree, supprimer de la base
- `404 Not Found` : Endpoint invalide, supprimer
- `413 Payload Too Large` : Reduire la taille du message

---

## Flux utilisateur

1. L'utilisateur visite la page de parametres ou recoit une invite
2. Il clique sur "Activer les notifications"
3. Le navigateur demande la permission
4. Si accepte, le Service Worker s'abonne au push
5. La subscription est envoyee et stockee en base
6. Quand un evenement se produit (resultat, enchere...) :
   - Notification in-app creee (comme avant)
   - Push notification envoyee a tous les appareils abonnes
7. L'utilisateur recoit une banniere systeme meme si l'app est fermee
8. Au clic, l'app s'ouvre sur la page pertinente

---

## Estimation

- **Complexite** : Moyenne a elevee (Service Worker, chiffrement, gestion d'erreurs)
- **Fichiers impactes** : ~8-10 fichiers
- **Dependances** : Aucune nouvelle dependance npm (utilisation native de l'API Web Push dans le SW, et Deno pour l'edge function)

---

## Limitations connues

1. **iOS Safari** : Requiert iOS 16.4+, PWA installee, et permission explicite
2. **Firefox** : Support complet mais implementation legerement differente
3. **Incognito/Private** : Push non disponible en navigation privee
4. **Batterie** : Les notifications push peuvent affecter l'autonomie sur mobile
