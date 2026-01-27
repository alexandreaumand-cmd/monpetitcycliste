

# Ouvrir la startlist concernee depuis une notification

## Contexte

Actuellement, quand on clique sur une notification de type `startlist_validated`, la navigation se fait vers `/dashboard/startlist` sans ouvrir automatiquement la startlist concernee.

Les notifications contiennent deja le `startlist_id` dans leurs metadonnees :
```json
{
  "metadata": {
    "race_id": "alula_tour",
    "startlist_id": "fd22cf05-18c7-4b98-9b3c-6f6802f7e95d",
    "race_name": "AlUla Tour"
  }
}
```

---

## Solution

Ajouter un parametre `startlistId` dans l'URL et faire en sorte que les pages Startlist (desktop et mobile) ouvrent automatiquement la vue de la startlist correspondante.

---

## Modifications techniques

### 1. Fichier : `src/components/layout/NotificationCenter.tsx`

**Modifier la navigation pour inclure le `startlistId` (ligne 94-95)**

| Avant | Apres |
|-------|-------|
| `navigate('/dashboard/startlist')` | `navigate('/dashboard/startlist?startlistId=...')` |

```tsx
if (notification.type === 'startlist_validated') {
  const startlistId = notification.metadata?.startlist_id;
  const leagueId = notification.metadata?.league_id;
  const params = new URLSearchParams();
  if (leagueId) params.set('leagueId', leagueId);
  if (startlistId) params.set('startlistId', startlistId);
  navigate(`/dashboard/startlist?${params.toString()}`);
}
```

---

### 2. Fichier : `src/pages/Startlist.desktop.tsx`

**Ajouter la lecture du query param `startlistId` et ouvrir la vue automatiquement**

```tsx
// Import
import { useSearchParams } from "react-router-dom";

// Dans le composant (apres ligne 46)
const [searchParams, setSearchParams] = useSearchParams();
const startlistIdFromUrl = searchParams.get('startlistId');

// Effect pour ouvrir la vue si startlistId present (apres ligne 63)
useEffect(() => {
  if (startlistIdFromUrl) {
    setSelectedStartlistId(startlistIdFromUrl);
    setViewMode('view');
    // Nettoyer l'URL apres ouverture
    searchParams.delete('startlistId');
    setSearchParams(searchParams, { replace: true });
  }
}, [startlistIdFromUrl]);
```

---

### 3. Fichier : `src/pages/Startlist.mobile.tsx`

**Meme logique pour la version mobile**

```tsx
// Import
import { useSearchParams } from "react-router-dom";

// Dans le composant (apres ligne 52)
const [searchParams, setSearchParams] = useSearchParams();
const startlistIdFromUrl = searchParams.get('startlistId');

// Effect pour ouvrir la vue si startlistId present (apres ligne 53)
useEffect(() => {
  if (startlistIdFromUrl) {
    setSelectedStartlistId(startlistIdFromUrl);
    setViewMode('view');
    // Nettoyer l'URL apres ouverture
    searchParams.delete('startlistId');
    setSearchParams(searchParams, { replace: true });
  }
}, [startlistIdFromUrl]);
```

---

### 4. Fichier : `public/sw-push.js`

**Mettre a jour la fonction `getUrlForNotificationType` pour les push notifications (ligne 110)**

```javascript
case 'startlist_validated':
  if (metadata?.startlist_id) {
    const params = new URLSearchParams();
    if (metadata.league_id) params.set('leagueId', metadata.league_id);
    params.set('startlistId', metadata.startlist_id);
    return `${baseUrl}/startlist?${params.toString()}`;
  }
  return `${baseUrl}/startlist`;
```

---

## Flux utilisateur

```text
+------------------------------------+
|  Startlist validee                 |
|     AlUla Tour                     |
|     il y a 2 heures                |
+------------------------------------+
                  |
                  | Clic
                  v
+------------------------------------+
|  Navigation vers :                 |
|  /dashboard/startlist?             |
|    startlistId=fd22cf05-...        |
+------------------------------------+
                  |
                  v
+------------------------------------+
|  Vue startlist "AlUla Tour"        |
|  s'ouvre automatiquement           |
|  +------------------------------+  |
|  | AlUla Tour                   |  |
|  | Parcours + Managers          |  |
|  | ...                          |  |
|  +------------------------------+  |
+------------------------------------+
```

---

## Resume des fichiers a modifier

| Fichier | Modification |
|---------|--------------|
| `src/components/layout/NotificationCenter.tsx` | Ajouter `startlistId` dans l'URL de navigation |
| `src/pages/Startlist.desktop.tsx` | Lire `startlistId` et ouvrir la vue |
| `src/pages/Startlist.mobile.tsx` | Lire `startlistId` et ouvrir la vue |
| `public/sw-push.js` | Mettre a jour l'URL pour les push notifications |

