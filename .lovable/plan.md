

# Implementation Complete des Notifications Push

## Resume

Ce plan couvre l'implementation complete des notifications push PWA, incluant les preferences utilisateur pour activer/desactiver les types de notifications (resultats, startlists, encheres).

---

## Etape 1 : Configuration des Secrets VAPID

### Prerequis
Avant toute implementation, les cles VAPID doivent etre configurees :
- `VAPID_PUBLIC_KEY` : Cle publique (utilisee par le frontend pour s'abonner)
- `VAPID_PRIVATE_KEY` : Cle privee (utilisee par le serveur pour signer les notifications)
- `VAPID_SUBJECT` : Email de contact (ex: `mailto:contact@monpetitcycliste.com`)

Pour generer ces cles, executez localement :
```text
npx web-push generate-vapid-keys
```

---

## Etape 2 : Base de Donnees - Preferences Utilisateur

### Nouvelle colonne sur `push_subscriptions`

Ajouter une colonne JSON pour stocker les preferences de notification par type :

```sql
ALTER TABLE public.push_subscriptions 
ADD COLUMN preferences jsonb DEFAULT '{"results": true, "startlists": true, "auctions": true}'::jsonb;
```

Cette structure permet :
- `results`: Notifications de victoire (type `results_added`)
- `startlists`: Notifications de validation de startlist (type `startlist_validated`)
- `auctions`: Notifications d'encheres (types `auction_opened`, `auction_closed`, `auction_validation`)

---

## Etape 3 : Service Worker Custom

### Fichier : `public/sw-push.js`

Ce Service Worker sera injecte dans le SW genere par vite-plugin-pwa pour gerer les evenements push.

Fonctionnalites :
- Ecouter l'evenement `push` pour afficher les notifications systeme
- Gerer le clic sur la notification pour ouvrir l'app sur la bonne page
- Personnalisation de l'icone et du badge

```text
Logique du clic :
- results_added -> /dashboard/resultats
- startlist_validated -> /dashboard/startlist
- auction_* -> /dashboard/encheres?leagueId=...
```

---

## Etape 4 : Configuration Vite

### Modification : `vite.config.ts`

Configurer `vite-plugin-pwa` pour importer le Service Worker custom via `importScripts`.

```text
workbox: {
  importScripts: ['sw-push.js']
}
```

---

## Etape 5 : Hook Frontend

### Nouveau fichier : `src/hooks/usePushNotifications.ts`

Interface retournee :
```text
{
  isSupported: boolean         // Navigateur compatible
  permission: string           // 'granted', 'denied', 'default'
  isSubscribed: boolean        // Abonnement actif
  preferences: {               // Preferences par type
    results: boolean
    startlists: boolean
    auctions: boolean
  }
  subscribe: () => Promise<void>
  unsubscribe: () => Promise<void>
  updatePreferences: (prefs) => Promise<void>
  isLoading: boolean
}
```

Le hook utilise :
- `navigator.serviceWorker.ready` pour obtenir le SW actif
- `pushManager.subscribe()` avec la cle publique VAPID
- Stockage/suppression de la subscription dans `push_subscriptions`

---

## Etape 6 : Composant UI de Preferences

### Nouveau fichier : `src/components/settings/NotificationSettings.tsx`

Ce composant sera integre dans la page de profil (`AccountPage.tsx`) comme nouvelle section.

Design propose :
```text
+--------------------------------------------------+
| 🔔 Notifications                                 |
| Gerez vos preferences de notification            |
+--------------------------------------------------+
|                                                  |
| [Switch] Activer les notifications push          |
|          Recevez des alertes meme hors de l'app  |
|                                                  |
| --- Types de notifications ---                   |
|                                                  |
| [Switch] Resultats de course                     |
|          Victoires de vos coureurs               |
|                                                  |
| [Switch] Startlists validees                     |
|          Nouvelles startlists disponibles        |
|                                                  |
| [Switch] Encheres                                |
|          Ouverture et cloture des rounds         |
|                                                  |
+--------------------------------------------------+
```

Etats possibles :
- Push non supporte : Message explicatif
- Permission refusee : Instructions pour reactiver
- Non abonne : Bouton pour activer
- Abonne : Switches pour chaque type

---

## Etape 7 : Edge Function d'Envoi

### Nouveau fichier : `supabase/functions/send-push-notification/index.ts`

Responsabilites :
1. Recevoir le payload (user_ids, title, message, type, metadata)
2. Filtrer les subscriptions selon le type et les preferences
3. Envoyer les notifications via Web Push
4. Supprimer les subscriptions expirees (codes 404, 410)

Protocole Web Push :
- Chiffrement du payload avec les cles p256dh/auth
- Signature VAPID avec la cle privee
- POST vers l'endpoint du navigateur

---

## Etape 8 : Integration avec Notifications Existantes

### Modification : `supabase/functions/_shared/notifications.ts`

Apres l'insertion des notifications in-app, appeler l'edge function `send-push-notification` pour envoyer les push.

```text
Flux :
1. Creer notification in-app (comme avant)
2. Appeler send-push-notification avec :
   - user_ids des destinataires
   - type de notification
   - titre et message
   - metadata (pour le deep link)
```

### Triggers PostgreSQL

Pour les triggers `notify_results_added` et `notify_startlist_validated`, ajouter un appel HTTP vers l'edge function apres l'insertion des notifications.

Option alternative : Creer un trigger `AFTER INSERT ON notifications` qui appelle automatiquement l'edge function.

---

## Etape 9 : Traductions i18n

### Modifications : `src/i18n/locales/fr/account.json` et `en/account.json`

Nouvelles cles :
```json
{
  "notifications": {
    "title": "Notifications",
    "description": "Gerez vos preferences de notification",
    "enablePush": "Activer les notifications push",
    "enablePushDescription": "Recevez des alertes meme hors de l'application",
    "types": {
      "results": "Resultats de course",
      "resultsDescription": "Victoires de vos coureurs",
      "startlists": "Startlists validees",
      "startlistsDescription": "Nouvelles startlists disponibles",
      "auctions": "Encheres",
      "auctionsDescription": "Ouverture et cloture des rounds"
    },
    "notSupported": "Votre navigateur ne supporte pas les notifications push",
    "denied": "Vous avez bloque les notifications. Pour les reactiver, modifiez les parametres de votre navigateur.",
    "iosInstructions": "Sur iOS, installez d'abord l'app sur votre ecran d'accueil"
  }
}
```

---

## Resume des Fichiers

### Fichiers a creer

| Fichier | Description |
|---------|-------------|
| `public/sw-push.js` | Service Worker pour recevoir les push |
| `src/hooks/usePushNotifications.ts` | Hook de gestion des abonnements |
| `src/components/settings/NotificationSettings.tsx` | UI des preferences |
| `supabase/functions/send-push-notification/index.ts` | Edge function d'envoi |

### Fichiers a modifier

| Fichier | Modification |
|---------|--------------|
| `vite.config.ts` | Ajouter `importScripts` pour le SW custom |
| `src/pages/AccountPage.tsx` | Integrer NotificationSettings |
| `supabase/functions/_shared/notifications.ts` | Appeler send-push-notification |
| `src/i18n/locales/fr/account.json` | Traductions FR |
| `src/i18n/locales/en/account.json` | Traductions EN |
| Migration SQL | Ajouter colonne `preferences` |

---

## Flux Complet

```text
1. Utilisateur va sur /dashboard/compte
2. Section "Notifications" affichee
3. Clic "Activer les notifications push"
4. Navigateur demande la permission
5. Si accepte :
   a. Service Worker s'abonne au push
   b. Subscription stockee en base avec preferences par defaut
6. Utilisateur peut basculer chaque type (resultats, startlists, encheres)
7. Quand un evenement se produit :
   a. Trigger/Edge function cree notification in-app
   b. send-push-notification verifie les preferences
   c. Push envoye aux abonnes ayant active ce type
8. Utilisateur recoit banniere systeme meme app fermee
9. Clic sur notification ouvre l'app sur la bonne page
```

---

## Dependance Critique

**Rappel** : Cette implementation necessite d'abord la configuration des secrets VAPID. Sans ces cles, les notifications push ne peuvent pas fonctionner.

