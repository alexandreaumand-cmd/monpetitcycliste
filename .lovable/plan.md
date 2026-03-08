

# Plan: Déplacer le broadcast Live Courses dans le Super Admin

## Contexte actuel
- Le super admin broadcast les messages live depuis la tab "Live" de l'Arena (dans le contexte d'une ligue)
- Le RPC `arena_broadcast_live_message` copie déjà le message dans toutes les ligues
- La gestion des courses actives (activer/désactiver) se fait aussi depuis l'Arena

## Ce qui change
Créer une page dédiée dans le Super Admin pour le broadcast live, indépendante de toute ligue. L'Arena côté user reste en lecture seule.

## Fichiers impactés

| Fichier | Action |
|---|---|
| `src/pages/admin/SuperAdminLiveBroadcastPage.tsx` | **Créer** — Page complète : sélection course active, composition de messages, historique des messages broadcastés |
| `src/pages/SuperAdminPage.desktop.tsx` | **Modifier** — Ajouter route "Live Broadcast" dans le groupe "Ligues & Arène" |
| `src/pages/SuperAdminPage.mobile.tsx` | **Modifier** — Ajouter le lien nav mobile |
| `src/components/arena/LiveCoursesTab.tsx` | **Modifier** — Supprimer la logique de broadcast (handleSend superadmin), garder uniquement la lecture + réactions |
| `src/components/arena/LiveCourseSelector.tsx` | **Modifier** — Supprimer le bouton "Manage" (activer/désactiver) de la vue user, déplacer dans la page admin |

## Architecture de la page admin

La page `SuperAdminLiveBroadcastPage` contient :

1. **Gestion des courses live** — Activer/désactiver des courses (même logique que `AddLiveCourseButton` actuel, mais en tant que section permanente)
2. **Sélection de la course active** — Chips comme actuellement
3. **Composition du message** — Réutilise `MessageInput` avec la liste des coureurs de la startlist de la course sélectionnée (pas de mentions managers car pas de contexte ligue)
4. **Historique** — Affiche les messages broadcastés récents (query `arena_messages` filtrée `message_type = 'admin_broadcast'` + `course_id`, sans filtre league — on prend une ligue au hasard via `source_message_id IS NULL` ou on query directement)

Le broadcast utilise le même RPC `arena_broadcast_live_message` existant.

## Simplification côté Arena user
- `LiveCoursesTab` : retirer le `if (isSuperAdmin)` dans `handleSend`, le canal devient **100% lecture seule** pour tout le monde (les réactions restent)
- `LiveCourseSelector` : retirer `AddLiveCourseButton` et le prop `isSuperAdmin`

