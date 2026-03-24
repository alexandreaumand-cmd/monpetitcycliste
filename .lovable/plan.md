

# Fix: Inverser la logique du toggle "Sans manager"

## Problème

Le toggle "Sans manager" est contre-intuitif : quand il est activé, il **masque** les coureurs sans manager. L'utilisateur s'attend à l'inverse — activer "Sans manager" pour **ne voir que** les coureurs sans manager.

## Solution

Inverser la logique du filtre dans les 2 fichiers concernés :

### 1. `src/components/rankings/TopRiders.tsx` (desktop)

- Renommer l'état `hideRidersWithoutManagers` → `showOnlyWithoutManagers`
- Quand activé : filtrer pour ne garder **que** les coureurs **sans** manager (inverser la condition ~ligne 205-213)
- Mettre à jour le label et le Switch

### 2. `src/pages/Rankings.mobile.tsx` (mobile)

- Même renommage et inversion de logique (~ligne 189-191)

### 3. Traductions

Mettre à jour `fr/rankings.json` et `en/rankings.json` :
- `hideWithoutManager` : "Sans manager" → "Sans manager" (le label reste le même, c'est la logique qui change)

La sémantique devient : toggle OFF = tous les coureurs, toggle ON = uniquement les coureurs sans manager.

### Fichiers modifiés
- `src/components/rankings/TopRiders.tsx`
- `src/pages/Rankings.mobile.tsx`

