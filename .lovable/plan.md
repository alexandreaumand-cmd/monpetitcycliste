
# Ouvrir la course concernée depuis une notification de résultat

## Contexte

Actuellement, quand on clique sur une notification de type `results_added` (ex: "Victoire de Jonathan MILAN - AlUla Tour"), la navigation se fait vers `/dashboard/resultats` sans ouvrir automatiquement la course concernée.

Les notifications contiennent déjà le `course_id` dans leurs métadonnées :
```json
{
  "metadata": {
    "course_id": "alula_tour",
    "race_name": "AlUla Tour",
    "league_id": "85d46f9b-..."
  }
}
```

---

## Solution

Ajouter un paramètre `courseId` dans l'URL et faire en sorte que les pages Résultats (desktop et mobile) ouvrent automatiquement le drawer de la course correspondante.

---

## Modifications techniques

### 1. Fichier : `src/components/layout/NotificationCenter.tsx`

**Modifier la navigation pour inclure le `courseId` (ligne 96-97)**

| Avant | Après |
|-------|-------|
| `navigate('/dashboard/resultats')` | `navigate('/dashboard/resultats?courseId=...')` |

```tsx
} else if (notification.type === 'results_added') {
  const courseId = notification.metadata?.course_id;
  const leagueId = notification.metadata?.league_id;
  const params = new URLSearchParams();
  if (leagueId) params.set('leagueId', leagueId);
  if (courseId) params.set('courseId', courseId);
  navigate(`/dashboard/resultats?${params.toString()}`);
}
```

---

### 2. Fichier : `src/pages/ResultsPage.desktop.tsx`

**Ajouter la lecture du query param `courseId` et ouvrir le drawer automatiquement**

```tsx
// Import
import { useSearchParams } from "react-router-dom";

// Dans le composant
const [searchParams, setSearchParams] = useSearchParams();
const courseIdFromUrl = searchParams.get('courseId');

// Effect pour ouvrir le drawer si courseId présent
useEffect(() => {
  if (courseIdFromUrl) {
    setSelectedCourseId(courseIdFromUrl);
    setDrawerOpen(true);
    // Nettoyer l'URL après ouverture
    searchParams.delete('courseId');
    setSearchParams(searchParams, { replace: true });
  }
}, [courseIdFromUrl]);
```

---

### 3. Fichier : `src/pages/ResultsPage.mobile.tsx`

**Même logique pour la version mobile**

```tsx
// Import
import { useSearchParams } from "react-router-dom";

// Dans le composant
const [searchParams, setSearchParams] = useSearchParams();
const courseIdFromUrl = searchParams.get('courseId');

// Effect pour ouvrir le drawer si courseId présent
useEffect(() => {
  if (courseIdFromUrl) {
    setSelectedCourseId(courseIdFromUrl);
    setDrawerOpen(true);
    // Nettoyer l'URL après ouverture
    searchParams.delete('courseId');
    setSearchParams(searchParams, { replace: true });
  }
}, [courseIdFromUrl]);
```

---

### 4. Fichier : `public/sw-push.js`

**Mettre à jour la fonction `getUrlForNotificationType` pour les push notifications (ligne 91)**

```javascript
case 'results_added':
  if (metadata?.course_id) {
    const params = new URLSearchParams();
    if (metadata.league_id) params.set('leagueId', metadata.league_id);
    params.set('courseId', metadata.course_id);
    return `${baseUrl}/resultats?${params.toString()}`;
  }
  return `${baseUrl}/resultats`;
```

---

## Flux utilisateur

```text
┌────────────────────────────────────┐
│  🏆 Victoire de Jonathan MILAN    │
│     AlUla Tour                     │
│     il y a environ 7 heures        │
└────────────────────────────────────┘
                  │
                  │ Clic
                  ▼
┌────────────────────────────────────┐
│  Navigation vers :                 │
│  /dashboard/resultats?             │
│    leagueId=85d46f9b-...&          │
│    courseId=alula_tour             │
└────────────────────────────────────┘
                  │
                  ▼
┌────────────────────────────────────┐
│  Drawer "AlUla Tour" s'ouvre       │
│  automatiquement                   │
│  ┌──────────────────────────────┐  │
│  │ AlUla Tour                   │  │
│  │ Étape 1 - Jonathan MILAN 🏆  │  │
│  │ ...                          │  │
│  └──────────────────────────────┘  │
└────────────────────────────────────┘
```

---

## Résumé des fichiers à modifier

| Fichier | Modification |
|---------|--------------|
| `src/components/layout/NotificationCenter.tsx` | Ajouter `courseId` dans l'URL de navigation |
| `src/pages/ResultsPage.desktop.tsx` | Lire `courseId` et ouvrir le drawer |
| `src/pages/ResultsPage.mobile.tsx` | Lire `courseId` et ouvrir le drawer |
| `public/sw-push.js` | Mettre à jour l'URL pour les push notifications |
