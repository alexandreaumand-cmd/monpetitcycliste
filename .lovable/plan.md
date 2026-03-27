

## Fix de l'auto-import : dédupliquer les événements diffusés

### Problème principal
Chaque auto-scrape (toutes les 60s) **re-diffuse TOUS les événements** de la timeline vers les ligues. Le scraper L'Équipe retourne tous les événements visibles sur la page, et `handleScrape` les broadcast tous à chaque exécution — sans aucune déduplication. Résultat : les ligues reçoivent des dizaines de messages dupliqués.

Même problème pour la situation de course : elle est re-diffusée intégralement toutes les 60s.

### Problème secondaire — erreur de déploiement
L'erreur `GIT_FILES_NOT_LISTABLE` est une erreur d'infrastructure transitoire (git interne). Elle se résoudra au prochain déploiement. Je vais déclencher un re-deploy de l'edge function après les changements.

### Solution

**`src/pages/admin/SuperAdminLiveBroadcastPage.tsx`** — 3 modifications :

#### 1. Tracker des événements déjà diffusés
Ajouter un `useRef<Set<string>>` qui stocke une signature unique par événement déjà envoyé (combinaison `time + title + text.substring(0,50)`). Avant de broadcaster un événement, vérifier s'il est déjà dans le set.

```typescript
const sentEventsRef = useRef<Set<string>>(new Set());

// Signature d'un événement
const eventKey = (evt: TimelineEvent) => `${evt.time}|${(evt.title||'').substring(0,30)}|${evt.text.substring(0,50)}`;
```

#### 2. Filtrer les nouveaux événements avant broadcast
Dans la section auto-broadcast (~ligne 347-366), ne broadcaster que les événements dont la clé n'est pas dans `sentEventsRef` :

```typescript
const newEvents = reversedEvents.filter(evt => !sentEventsRef.current.has(eventKey(evt)));
if (newEvents.length === 0) {
  // Pas de nouveaux événements, skip
} else {
  for (const evt of newEvents) {
    // ... broadcast ...
    sentEventsRef.current.add(eventKey(evt));
  }
  toast.success(`${sent} nouveaux événements diffusés`);
}
```

#### 3. Dédupliquer la situation de course
Stocker la dernière signature de situation diffusée (hash des groupes + km). Ne re-diffuser que si elle a changé :

```typescript
const lastSituationRef = useRef<string>("");

// Avant de broadcaster la situation
const sitKey = JSON.stringify(situation.groups.map(g => g.name + g.gap + g.riders.length)) + situation.kmRemaining;
if (sitKey !== lastSituationRef.current) {
  // broadcast...
  lastSituationRef.current = sitKey;
}
```

#### 4. Reset des trackers quand la course change
Quand `activeCourseId` change, vider `sentEventsRef` et `lastSituationRef`.

### Fichier impacté
- `src/pages/admin/SuperAdminLiveBroadcastPage.tsx` — ajout de la déduplication des broadcasts

