
Objectif
- Corriger l’erreur “Échec lors de l’envoi du test” quand tu cliques sur le bouton de test dans l’app installée (PWA) sur Android/Chrome, et rendre l’envoi fiable + facilement débuggable.

Constat (à partir du code actuel)
- La fonction backend `send-push-notification` ne renvoie les headers CORS que pour les requêtes OPTIONS.
- Or `supabase.functions.invoke(...)` est un appel cross-origin (ton app → domaine des fonctions). Le navigateur exige alors des headers CORS sur la réponse finale (POST aussi), pas seulement sur le preflight.
- Sans ces headers, l’appel est bloqué côté navigateur (souvent “Failed to fetch”), et côté UI tu vois “Erreur lors de l’envoi du test”.
- Les secrets VAPID existent bien (VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT), donc ce n’est probablement pas un “secret manquant”.
- Le bouton de test s’affiche (donc `isSubscribed === true`), mais l’appel échoue (donc problème transport/CORS ou erreur 500 côté fonction).

Solution proposée (modifs code)
1) Corriger CORS sur TOUTES les réponses de la fonction backend
- Ajouter un middleware Hono qui applique systématiquement :
  - Access-Control-Allow-Origin: *
  - Access-Control-Allow-Headers: authorization, x-client-info, apikey, content-type
  - Access-Control-Allow-Methods: POST, OPTIONS
- S’assurer que chaque `return c.json(...)` ou erreur renvoie aussi ces headers.
- Résultat attendu : `supabase.functions.invoke('send-push-notification')` ne sera plus bloqué par le navigateur dans la PWA.

2) Rendre les erreurs visibles (pour ne plus avoir un toast “Erreur” sans cause)
- Dans la fonction backend:
  - Loguer clairement les étapes clés : “request received”, “subscriptions fetched”, “sending web push”, “push response status”.
  - Quand une exception survient, renvoyer un JSON structuré (avec CORS) contenant un code + message court (pas de données sensibles).
- Dans le frontend (NotificationSettings):
  - Afficher dans le toast le message `response.error.message` quand il existe.
  - En complément, loguer `response.error` complet dans la console (déjà partiellement fait, mais on peut le rendre plus explicite).

3) Améliorer la compatibilité Web Push côté FCM (Android/Chrome)
- Ajouter le header `Crypto-Key` côté requête vers l’endpoint push, au minimum avec la clé VAPID publique au format attendu :
  - `Crypto-Key: p256ecdsa=<VAPID_PUBLIC_KEY>`
- Garder TTL/Urgency déjà présents.
- (Optionnel selon retours) si on observe des 401/403 depuis l’endpoint push, ajuster le format exact des headers VAPID conformément aux attentes de FCM.

4) Validation rapide après correctif
- Depuis la PWA Android :
  - Revenir dans /dashboard/compte → Notifications
  - Cliquer “Envoyer une notification test”
- Vérifications attendues :
  - Le toast doit devenir “Notification envoyée …” (ou afficher une erreur détaillée au lieu de “Erreur générique”).
  - Les logs de la fonction doivent montrer la réception de la requête et l’état de l’envoi.
  - Si `sent: 1`, la notification doit apparaître sur Android (écran verrouillé / centre de notifications).

5) Si la notification est “envoyée” mais toujours invisible (plan B ciblé)
- Vérifier que tu testes bien sur l’URL publiée (pas preview), car certaines plateformes gèrent les permissions par origin.
- Ajouter un “health check” côté client :
  - Afficher l’endpoint de subscription (tronqué) + l’état `Notification.permission` + `pushManager.getSubscription()` (uniquement pour debug, sans exposer de secrets).
- Ajuster “click action / deep link” si la notification arrive mais ne s’affiche pas (peu probable si elle n’apparaît jamais).

Fichiers concernés (à modifier en implémentation)
- `supabase/functions/send-push-notification/index.ts`
  - Middleware CORS global
  - Enrichissement logs + erreurs
  - Header `Crypto-Key` sur l’envoi vers l’endpoint push
- `src/components/settings/NotificationSettings.tsx`
  - Affichage détaillé de `response.error.message` dans le toast
  - (Optionnel) état UI plus précis (ex: “Requête envoyée au serveur”, “Notification envoyée”)

Risques / effets secondaires
- CORS en `*` est acceptable ici parce que l’envoi est contrôlé (on envoie à des `user_ids` et l’app exige une session). On gardera néanmoins des validations d’entrée et un comportement sûr (pas d’exposition de données).
- Ajouter plus de logs aide le debug, mais on évitera d’y mettre des endpoints complets ou des clés.

Critère de réussite
- Sur Android/Chrome (PWA installée) : cliquer sur “Envoyer une notification test” n’affiche plus “Échec lors de l’envoi du test”.
- Idéalement : la notification apparaît effectivement sur le téléphone.
