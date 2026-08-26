# Notification « Victoire » au manager propriétaire

Quand l'évènement livetext **Victoire** est détecté sur un coureur, le manager qui le possède reçoit une notification personnalisée, ligue par ligue.

## Comportement

- Texte : `Bravo ! Ton coureur Wout Van Aert a gagné ! 😻 - Ligue MPC 2026`
- Titre de la notification : `😻 Victoire d'un de tes coureurs`
- Une notification par ligue diffusée où le coureur appartient à un manager (résolution via l'effectif de la phase en cours). Si personne ne le possède, aucune notification.
- Envoi une seule fois par évènement (même déduplication que la timeline).
- Notification in-app (cloche) + push si activé ; clic → page Live de la course.
- La bascule existante dans **Mon compte > Notifications** couvre ce type : son libellé devient « Évènements sur mes coureurs (chutes, abandons, victoires) ».

## Détails techniques

1. `supabase/functions/live-broadcast-auto-scrape/index.ts`
   - Élargir `notifyIncidents` (renommée logiquement en notifications d'évènements coureur) pour retenir aussi `ev.type === "win"`.
   - Pour les victoires : type de notification `rider_win`, titre/message dédiés (pas d'accroche sur le prix), metadata identique (course_id, league_id, coureur_id, event_type, live_event_uid, etape_numero).
   - Push envoyé individuellement par manager avec `type: "rider_win"`.

2. `supabase/functions/send-push-notification/index.ts`
   - `getPreferenceKey` : mapper `rider_win` sur la clé de préférence existante `incidents`.

3. `src/hooks/useNotifications.ts` + `src/components/.../NotificationCenter.tsx`
   - Gérer le type `rider_win` : icône 🥇 et redirection vers la page Live de la course (même logique que `rider_incident`).

4. `src/components/settings/NotificationSettings.tsx` + traductions `account` (fr/en)
   - Mettre à jour le libellé/description de la bascule pour inclure les victoires.

Aucune migration de base de données nécessaire.
