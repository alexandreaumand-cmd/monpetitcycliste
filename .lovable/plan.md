# Notifications « chute / abandon » au manager du coureur

Quand un évènement live de type **chute** ou **abandon** est détecté sur un coureur, le manager qui possède ce coureur reçoit une notification personnalisée, ligue par ligue.

## Comportement

- Message type : `Tu la sens la douille à 551M ? Chute de Wout Van Aert sur la Vuelta a España - Ligue MPC 2026`
- Variante abandon : `Abandon de Wout Van Aert sur la Vuelta a España - Ligue MPC 2026` (même accroche avec le prix payé).
- Une notification par ligue concernée : si le coureur appartient à des managers différents dans plusieurs ligues, chacun est notifié avec le prix de sa ligue.
- Envoi une seule fois par évènement (même clé de déduplication que la timeline, pour éviter les doublons à chaque passage du scraper).
- Notification in-app (cloche) + notification push si le manager a activé le push.
- Si le coureur n'est possédé par personne dans la ligue, aucune notification.

## Désactivation par le manager

Dans **Mon compte > Notifications**, nouvelle bascule « Chutes & abandons de mes coureurs » (activée par défaut). Elle s'ajoute aux bascules existantes (résultats, startlists, enchères, pronostics) et coupe l'envoi push pour ce type d'évènement.

## Détails techniques

1. `supabase/functions/live-broadcast-auto-scrape/index.ts`
   - Après l'insertion des évènements livetext, filtrer ceux de type `crash` / `abandon` réellement nouveaux.
   - Pour chaque (ligue diffusée, coureur), résoudre le propriétaire via `rosters` (league_id + phase active + coureur_id) pour récupérer `manager_id` et `prix_signature`.
   - Insérer une ligne dans `notifications` (type `rider_incident`, metadata : course_id, league_id, coureur_id, event_type, prix, etape_numero) puis appeler `send-push-notification` avec les `user_id` des managers concernés.
   - Journaliser le nombre d'envois.

2. `supabase/functions/send-push-notification/index.ts`
   - `getPreferenceKey` : mapper le type `rider_incident` vers la nouvelle clé de préférence `incidents`.

3. `src/hooks/usePushNotifications.ts`
   - Ajouter `incidents: boolean` (défaut `true`) au type `PushPreferences`, aux valeurs par défaut et aux payloads de souscription/mise à jour (stockées dans `push_subscriptions.preferences`, aucun changement de schéma).

4. `src/components/settings/NotificationSettings.tsx`
   - Ajouter la bascule « Chutes & abandons de mes coureurs » avec description, câblée sur `incidents`.
   - Nouvelles clés i18n dans les fichiers de traduction du namespace `account`.

Aucune migration de base de données n'est nécessaire.
