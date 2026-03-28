

## Fix : le champ code d'invitation force tout en majuscule

### Cause racine

Dans `JoinLeagueDialog.tsx` ligne 279, le `onChange` applique `.toUpperCase()` sur la saisie :

```tsx
onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
```

Les tokens générés par `leagues-create-invite` sont **sensibles à la casse** (Base64url avec majuscules et minuscules). Forcer en majuscule rend le token invalide → "Invalid token".

### Solution

Supprimer le `.toUpperCase()` pour conserver la casse originale du token :

```tsx
onChange={(e) => setInviteCode(e.target.value)}
```

Mettre aussi à jour le placeholder pour refléter un format réaliste (mixte) au lieu de `ABC123DEF456`.

### Fichier impacté
- `src/components/leagues/JoinLeagueDialog.tsx` — ligne 279, supprimer `.toUpperCase()`

