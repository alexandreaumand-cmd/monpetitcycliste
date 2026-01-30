

# Plan : Notifications de résultats personnalisées

## Objectif
Enrichir les notifications push de résultats pour inclure :
- Le nom du vainqueur de l'étape/course
- Les points marqués par le manager dans chaque ligue

## Exemple de notification
```
🏁 Trofeo Serra Tramuntana - Étape 4

Victoire de Remco Evenepoel

Tu as marqué 45 points dans MPC 2026
Tu as marqué 12 points dans Liga Pro
```

## Architecture

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│                FLUX DE NOTIFICATION PERSONNALISÉE                            │
└──────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                     admin-result-save-lot (Edge Function)                   │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ 1. Sauvegarde les résultats en DB                                      │ │
│  │ 2. Récupère le vainqueur (position = 1)                                │ │
│  │ 3. Récupère les subscriptions push avec préférence 'results'           │ │
│  │ 4. Pour chaque user, calcule les points par ligue                      │ │
│  │ 5. Envoie une notification personnalisée par user                      │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                      ┌───────────────┴───────────────┐
                      ▼                               ▼
         ┌────────────────────────┐      ┌────────────────────────┐
         │  Notification User A  │      │  Notification User B   │
         │  ──────────────────── │      │  ────────────────────  │
         │  Victoire: Evenepoel  │      │  Victoire: Evenepoel   │
         │  MPC 2026: 45 pts     │      │  Liga Pro: 12 pts      │
         │  Liga Pro: 12 pts     │      │                        │
         └────────────────────────┘      └────────────────────────┘
```

## Modifications techniques

### 1. Edge Function `admin-result-save-lot`
**Fichier** : `supabase/functions/admin-result-save-lot/index.ts`

**Changements** :
- Après la sauvegarde des résultats, récupérer le vainqueur (coureur avec position = 1)
- Récupérer toutes les subscriptions push avec préférence `results` activée
- Pour chaque subscription, trouver le(s) manager(s) de l'utilisateur
- Pour chaque manager, calculer les points dans chaque ligue pour cette course
- Construire un message personnalisé pour chaque utilisateur
- Envoyer des notifications individuelles via `send-push-notification` au lieu d'un broadcast

### 2. Nouvelle interface de payload
```typescript
interface PersonalizedPushPayload {
  user_id: string;
  title: string;
  message: string;  // Message personnalisé avec points par ligue
  type: string;
  metadata: {
    course_id: string;
    course_name: string;
    winner_name?: string;
    points_by_league?: Array<{
      league_id: string;
      league_name: string;
      points: number;
    }>;
  };
}
```

### 3. Requête SQL pour les points par user/ligue
```sql
-- Pour chaque user_id de subscription, récupérer les points par ligue
SELECT 
  m.user_id,
  l.id as league_id,
  l.name as league_name,
  SUM(pl.points) as total_points
FROM points_ledger pl
JOIN courses c ON c.id = pl.course_id
JOIN rosters r ON r.coureur_id = pl.coureur_id AND r.phase_id = pl.phase_id
JOIN managers m ON m.id = r.manager_id
JOIN leagues l ON l.id = r.league_id
WHERE pl.course_id = $course_id
  AND (pl.etape_numero = $etape_numero OR (pl.etape_numero IS NULL AND $etape_numero IS NULL))
  AND pl.type_classement = $type_classement
GROUP BY m.user_id, l.id, l.name
```

### 4. Récupération du vainqueur
```sql
SELECT c.nom as winner_name
FROM race_results rr
JOIN coureurs c ON c.id = rr.coureur_id
WHERE rr.course_id = $course_id
  AND rr.type_classement = $type_classement
  AND (rr.etape_numero = $etape_numero OR (rr.etape_numero IS NULL AND $etape_numero IS NULL))
  AND rr.position = 1
LIMIT 1
```

### 5. Service Worker (aucun changement requis)
Le service worker `sw-push.js` affiche déjà `title` et `message` tels quels - il suffit de passer le message personnalisé.

## Détail de l'implémentation

### Phase 1 : Récupérer les données nécessaires
1. Après `supabaseWithAuth.rpc('admin_result_save_lot', ...)` 
2. Récupérer le vainqueur de la course
3. Récupérer les subscriptions push (avec user_id)
4. Récupérer les points par user/ligue pour cette course

### Phase 2 : Construire les messages personnalisés
Pour chaque subscription :
```typescript
const lines = [`Victoire de ${winnerName}`];
const userPoints = pointsByUser[subscription.user_id] || [];
for (const { league_name, points } of userPoints) {
  lines.push(`Tu as marqué ${Math.round(points)} points dans ${league_name}`);
}
const message = lines.join('\n');
```

### Phase 3 : Envoi individualisé
Au lieu d'un broadcast unique, envoyer N notifications (une par user) avec leur message personnalisé.

## Considérations

- **Performance** : Le calcul des points par ligue nécessite une requête supplémentaire, mais c'est acceptable car cette opération est peu fréquente (quelques fois par jour)
- **Fallback** : Si un utilisateur n'a marqué aucun point, afficher seulement le vainqueur
- **i18n** : Les messages sont en français, cohérent avec l'app existante
- **Points décimaux** : Arrondir à l'entier le plus proche avec `Math.round()`

## Fichiers modifiés
- `supabase/functions/admin-result-save-lot/index.ts` - Logique de notification personnalisée

