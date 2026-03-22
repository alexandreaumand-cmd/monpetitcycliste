

# Auto-marquer les notifications comme lues à l'ouverture du popover

## Problème
L'utilisateur doit cliquer sur chaque notification ou sur "Marquer tout comme lu" pour réinitialiser le compteur. Le simple fait d'ouvrir le popover (clic sur la cloche) devrait suffire.

## Solution

**Fichier** : `src/components/layout/NotificationCenter.tsx`

Utiliser `onOpenChange` du `Popover` pour appeler `markAllAsRead()` quand le popover s'ouvre et qu'il y a des notifications non lues.

- Remplacer `<Popover>` par `<Popover onOpenChange={(open) => { if (open && unreadCount > 0) markAllAsRead(); }}>`
- Supprimer le bouton "Marquer tout comme lu" qui devient inutile (ou le garder comme fallback — je propose de le supprimer pour simplifier l'UI)

