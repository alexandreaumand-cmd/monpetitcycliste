

# Implémentation Complète des Notifications Push PWA

## Résumé

Ce plan implémente les notifications push pour l'application Mon Petit Cycliste. Les utilisateurs pourront recevoir des alertes même lorsque l'application est fermée, avec la possibilité de choisir les types de notifications qu'ils souhaitent recevoir (résultats, startlists, enchères).

---

## Étape 1 : Configuration des Secrets VAPID

Configurer les 3 secrets nécessaires dans le projet :

| Secret | Valeur |
|--------|--------|
| VAPID_PUBLIC_KEY | BCfsjfWS47JE_QBAn1vRb72fPsfHbg6DeGYx7M0zZLb8FDj9zG3Ezk24TP6kb_OhJ5EMLzClH1NbayZ2ehMsp7U |
| VAPID_PRIVATE_KEY | nOTidJr-c4cAFBff8AClqtCYztRR7Ii2hXs9abh2cD4 |
| VAPID_SUBJECT | mailto:alexandre.aumand@gmail.com |

---

## Étape 2 : Migration Base de Données

Ajouter la colonne `preferences` à la table `push_subscriptions` existante pour stocker les préférences par type de notification :

```sql
ALTER TABLE public.push_subscriptions 
ADD COLUMN IF NOT EXISTS preferences jsonb 
DEFAULT '{"results": true, "startlists": true, "auctions": true}'::jsonb;
```

Structure des préférences :
- `results` : Notifications de victoire des coureurs
- `startlists` : Notifications de validation de startlist  
- `auctions` : Notifications d'ouverture/fermeture des enchères

---

## Étape 3 : Service Worker Push

Créer le fichier `public/sw-push.js` qui sera injecté dans le Service Worker généré par vite-plugin-pwa.

Fonctionnalités :
- Écouter l'événement `push` pour afficher les notifications système
- Gérer le clic sur la notification pour naviguer vers la bonne page
- Personnalisation avec l'icône de l'app

Logique de navigation au clic :
| Type | Destination |
|------|-------------|
| results_added | /dashboard/resultats |
| startlist_validated | /dashboard/startlist |
| auction_* | /dashboard/encheres?leagueId=... |

---

## Étape 4 : Modification vite.config.ts

Ajouter la configuration `importScripts` dans workbox pour charger le Service Worker custom :

```javascript
workbox: {
  importScripts: ['sw-push.js'],
  // ... reste de la config existante
}
```

---

## Étape 5 : Hook usePushNotifications

Créer `src/hooks/usePushNotifications.ts` pour gérer l'abonnement et les préférences.

Interface exposée :
```text
{
  isSupported: boolean         // Navigateur compatible
  permission: string           // 'granted', 'denied', 'default'
  isSubscribed: boolean        // Abonnement actif
  preferences: {               // Préférences par type
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

Le hook :
- Vérifie le support du navigateur
- Gère l'abonnement via `pushManager.subscribe()` avec la clé publique VAPID
- Stocke/supprime la subscription dans `push_subscriptions`
- Permet la mise à jour des préférences

---

## Étape 6 : Composant NotificationSettings

Créer `src/components/settings/NotificationSettings.tsx` avec l'interface suivante :

```text
+--------------------------------------------------+
| Notifications                                    |
| Gérez vos préférences de notification            |
+--------------------------------------------------+
|                                                  |
| [Switch] Activer les notifications push          |
|          Recevez des alertes même hors de l'app  |
|                                                  |
| --- Types de notifications ---                   |
| (visibles uniquement si push activé)             |
|                                                  |
| [Switch] Résultats de course                     |
|          Victoires de vos coureurs               |
|                                                  |
| [Switch] Startlists validées                     |
|          Nouvelles startlists disponibles        |
|                                                  |
| [Switch] Enchères                                |
|          Ouverture et fermeture des rounds       |
|                                                  |
+--------------------------------------------------+
```

États gérés :
- Push non supporté : Message explicatif
- Permission refusée : Instructions pour réactiver dans le navigateur
- Non abonné : Switch pour activer
- Abonné : Switches pour chaque type de notification

---

## Étape 7 : Intégration dans AccountPage

Ajouter une nouvelle section dans `src/pages/AccountPage.tsx` entre "Sécurité" et "Personnalisation" utilisant le composant `NotificationSettings`.

---

## Étape 8 : Edge Function send-push-notification

Créer `supabase/functions/send-push-notification/index.ts` pour envoyer les notifications.

Paramètres d'entrée :
```json
{
  "user_ids": ["uuid1", "uuid2"],
  "title": "Titre de la notification",
  "message": "Corps du message",
  "type": "results_added",
  "metadata": { "course_id": "...", "league_id": "..." }
}
```

Logique :
1. Récupérer les subscriptions des user_ids fournis
2. Filtrer selon le type et les préférences utilisateur
3. Envoyer les notifications via le protocole Web Push
4. Supprimer les subscriptions expirées (erreurs 404, 410)

---

## Étape 9 : Intégration avec le système de notifications existant

Modifier `supabase/functions/_shared/notifications.ts` pour appeler l'edge function `send-push-notification` après la création des notifications in-app.

Flux complet :
1. Événement déclenché (résultat, startlist, enchère)
2. Création notification in-app (existant)
3. Appel `send-push-notification` avec les user_ids et le type
4. Utilisateurs abonnés reçoivent la notification système

---

## Étape 10 : Traductions i18n

Ajouter les traductions dans les fichiers account.json (FR et EN) :

```json
{
  "notifications": {
    "title": "Notifications",
    "description": "Gérez vos préférences de notification",
    "enablePush": "Activer les notifications push",
    "enablePushDescription": "Recevez des alertes même hors de l'application",
    "types": {
      "results": "Résultats de course",
      "resultsDescription": "Victoires de vos coureurs",
      "startlists": "Startlists validées",
      "startlistsDescription": "Nouvelles startlists disponibles",
      "auctions": "Enchères",
      "auctionsDescription": "Ouverture et fermeture des rounds"
    },
    "notSupported": "Votre navigateur ne supporte pas les notifications push",
    "denied": "Vous avez bloqué les notifications. Pour les réactiver, modifiez les paramètres de votre navigateur.",
    "iosInstructions": "Sur iOS, installez d'abord l'app sur votre écran d'accueil"
  }
}
```

---

## Fichiers à Créer

| Fichier | Description |
|---------|-------------|
| `public/sw-push.js` | Service Worker pour recevoir les push |
| `src/hooks/usePushNotifications.ts` | Hook de gestion des abonnements |
| `src/components/settings/NotificationSettings.tsx` | UI des préférences |
| `supabase/functions/send-push-notification/index.ts` | Edge function d'envoi |

## Fichiers à Modifier

| Fichier | Modification |
|---------|--------------|
| `vite.config.ts` | Ajouter `importScripts` pour le SW custom |
| `src/pages/AccountPage.tsx` | Intégrer NotificationSettings |
| `supabase/functions/_shared/notifications.ts` | Appeler send-push-notification |
| `src/i18n/locales/fr/account.json` | Traductions FR |
| `src/i18n/locales/en/account.json` | Traductions EN |

---

## Section Technique

### Protocole Web Push

L'edge function `send-push-notification` utilisera le protocole Web Push natif avec la Web Crypto API pour :
1. Chiffrer le payload avec les clés `p256dh` et `auth` de chaque subscription
2. Signer la requête avec la clé privée VAPID
3. Envoyer via POST à l'endpoint du navigateur

### Gestion des erreurs

Les subscriptions retournant les codes suivants seront automatiquement supprimées :
- `404` : Subscription non trouvée
- `410` : Subscription expirée

### Sécurité

- Les clés VAPID sont stockées comme secrets (non accessibles côté client)
- La clé publique est exposée uniquement pour l'abonnement
- RLS policies existantes protègent les subscriptions par user_id

