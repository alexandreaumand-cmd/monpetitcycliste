

## Le sélecteur de phase est présent mais peu visible

### Diagnostic

Le sélecteur "Phase de départ" **existe bien** dans l'étape 3 "Variante" du wizard (lignes 316-336 de `CreateLeagueDialog.tsx`). Il est situé **en bas** de cette étape, après le bloc explicatif des 5 phases et les radio buttons de variante. Sur un écran de taille réduite, il peut nécessiter un scroll pour être visible.

De plus, le **récapitulatif** (étape 8/8, visible sur votre screenshot) **n'affiche pas** la phase de départ sélectionnée — il ne montre que la variante. Cela donne l'impression que le sélecteur n'existe pas.

### Corrections proposées

1. **Ajouter la phase de départ dans le récapitulatif** — une ligne `RecapRow` affichant "Phase de départ: Phase X" quand `startingPhaseIndex > 0` (ou "Automatique" si 0).

2. **Optionnel** : remonter le sélecteur de phase avant le bloc explicatif pour qu'il soit plus visible, ou le mettre dans sa propre étape.

### Détails techniques

Dans `CreateLeagueDialog.tsx`, au niveau du `case 'recap'` (après la ligne RecapRow pour la variante, ~ligne 543), ajouter :

```tsx
{selectedMode === 'five_phases' && (
  <RecapRow icon={<Flag className="h-4 w-4" />} label={t('wizard.recapStartingPhase')}
    value={startingPhaseIndex === 0 ? t('settings.startingPhaseDefault') : t('settings.startingPhaseOption', { num: startingPhaseIndex + 1 })} />
)}
```

Et ajouter les traductions `wizard.recapStartingPhase` ("Phase de départ" / "Starting phase") dans les fichiers i18n.

### Fichiers impactés
- `src/components/leagues/CreateLeagueDialog.tsx` — ajout RecapRow pour la phase de départ
- `src/i18n/locales/fr/leagues.json` — ajout clé `wizard.recapStartingPhase`
- `src/i18n/locales/en/leagues.json` — idem

