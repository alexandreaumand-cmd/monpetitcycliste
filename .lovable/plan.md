

## Différencier le visuel "phase en cours" du tick "sélectionné"

### Problème
Dans le sélecteur de phase (Rankings), la phase active affiche `✓` (via `t('phase.active')`) qui ressemble au checkmark de sélection du composant `Select`. Résultat : quand "Global" est sélectionné, on voit deux ticks — un pour la sélection et un pour la phase en cours.

### Solution

**`src/pages/Rankings.tsx`** (ligne 71) — Remplacer le `✓` par un indicateur visuel différent, par exemple un petit point coloré ou le texte "(en cours)" :

```typescript
// Avant :
P{phase.index_dans_saison}{phase.statut === 'active' ? ` ${t('phase.active')}` : ''}

// Après :
P{phase.index_dans_saison}{phase.statut === 'active' ? ' 🟢' : ''}
```

Un petit cercle vert `🟢` est immédiatement distinct du checkmark de sélection et indique clairement "phase en cours".

**`src/i18n/locales/fr/rankings.json`** et **`src/i18n/locales/en/rankings.json`** — Optionnel : mettre à jour `phase.active` de `"✓"` à `"🟢"` si on veut garder la logique via i18n (ou supprimer cette clé puisqu'on utilise directement l'emoji dans le code).

### Fichiers impactés
- `src/pages/Rankings.tsx` — changement du visuel d'indicateur de phase active

