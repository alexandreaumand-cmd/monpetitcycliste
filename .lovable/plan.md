
# Utiliser la ligue selectionnee pour les notifications de resultats

## Comportement actuel

Quand tu cliques sur une notification de resultats, le systeme navigue vers :
```
/dashboard/resultats?leagueId={league_id_de_la_notification}&courseId={course_id}
```

Le `league_id` provient des metadonnees de la notification (la ligue ou la course a eu lieu originellement).

## Comportement souhaite

Utiliser la ligue **actuellement selectionnee** dans l'interface :
```
/dashboard/resultats?leagueId={ligue_courante}&courseId={course_id}
```

---

## Modification

### Fichier : `src/components/layout/NotificationCenter.tsx`

**1. Ajouter l'import du contexte de ligue :**
```typescript
import { useLeague } from "@/contexts/LeagueContext";
```

**2. Utiliser le hook dans le composant :**
```typescript
export const NotificationCenter = ({ variant = 'default' }: NotificationCenterProps) => {
  const { t, i18n } = useTranslation('navigation');
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const navigate = useNavigate();
  const { leagueId: currentLeagueId } = useLeague(); // AJOUTER
  // ...
```

**3. Modifier la fonction `handleNotificationClick` pour `results_added` :**

Avant (lignes 101-107) :
```typescript
} else if (notification.type === 'results_added') {
  const courseId = notification.metadata?.course_id;
  const leagueId = notification.metadata?.league_id;
  const params = new URLSearchParams();
  if (leagueId) params.set('leagueId', leagueId);
  if (courseId) params.set('courseId', courseId);
  navigate(`/dashboard/resultats?${params.toString()}`);
}
```

Apres :
```typescript
} else if (notification.type === 'results_added') {
  const courseId = notification.metadata?.course_id;
  // Utiliser la ligue courante, sinon fallback sur celle de la notification
  const leagueId = currentLeagueId || notification.metadata?.league_id;
  const params = new URLSearchParams();
  if (leagueId) params.set('leagueId', leagueId);
  if (courseId) params.set('courseId', courseId);
  navigate(`/dashboard/resultats?${params.toString()}`);
}
```

---

## Resume

| Element | Modification |
|---------|--------------|
| Import | Ajouter `useLeague` |
| Hook | Extraire `currentLeagueId` |
| Navigation | Priorite a `currentLeagueId` pour `results_added` |

La modification est mineure (3 lignes) et garantit que le clic sur une notification de resultats ouvre les resultats dans le contexte de la ligue actuellement selectionnee.
