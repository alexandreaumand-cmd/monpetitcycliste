

## Plan : Citation unique et fixe au chargement

### Problème

Le `LoadingSpinner` est monté/démonté plusieurs fois pendant le chargement (Suspense → Index → Dashboard), et chaque instance tire une citation aléatoire différente. L'utilisateur voit donc les citations "défiler".

### Solution

Fixer la citation **une seule fois au niveau du module** au lieu de dans le composant. Comme l'import du module n'est exécuté qu'une fois par session, la même citation restera affichée peu importe combien de fois `LoadingSpinner` est monté.

### Changements

#### `src/components/shared/LoadingSpinner.tsx`

Remplacer le `useState(getRandomQuote)` par une constante au niveau module :

```tsx
const quote = getRandomQuote(); // exécuté une seule fois à l'import

export const LoadingSpinner = () => {
  return (
    // ... utiliser `quote` directement, supprimer le useState
  );
};
```

#### `index.html`

Aucun changement — le splash HTML tire déjà une seule citation au chargement.

### Fichier modifié

| Fichier | Changement |
|---|---|
| `src/components/shared/LoadingSpinner.tsx` | Citation fixée au niveau module |

