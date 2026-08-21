# Filtre managers dans « Top Coureurs » : 3 options claires

## Problème

Le bouton actuel est un interrupteur « Sans manager » : on ne comprend pas s'il masque ou affiche les coureurs sans manager (en réalité il n'affiche QUE les coureurs sans manager).

## Solution proposée

Remplacer l'interrupteur par un groupe de 3 boutons (segmented control), toujours visible, avec une seule option active :

- **Tous** — tous les coureurs (valeur par défaut)
- **Avec manager** — uniquement les coureurs possédés
- **Sans manager** — uniquement les coureurs libres

Le style reprend celui des boutons de tri déjà présents dans le classement Managers (pilules arrondies, option active en couleur primaire), donc cohérent avec le reste de la page.

Sur mobile, même groupe de 3 pilules, compactes, placé sous le champ de recherche à la place de l'interrupteur ; le choix reste mémorisé comme aujourd'hui.

## Détails techniques

- `src/components/rankings/TopRiders.tsx` : remplacer l'état booléen `showOnlyWithoutManagers` par `managerFilter: 'all' | 'with' | 'without'`, et adapter le filtre dans `filteredRiders` (test sur `owners` en vue phase, `owners_all` en vue globale). Remplacer le `Switch`/`Label` par un groupe de 3 boutons.
- `src/pages/Rankings.mobile.tsx` : même changement, en conservant `usePersistentState` (clé mise à jour vers `rankings.mobile.managerFilter`, valeur par défaut `all`).
- Traductions : ajouter `topRiders.managerFilter.all` / `.with` / `.without` dans `src/i18n/locales/fr/rankings.json` et `en/rankings.json` (« Tous », « Avec manager », « Sans manager »).

Aucun changement de données ni de requêtes backend : le filtrage reste côté client.
