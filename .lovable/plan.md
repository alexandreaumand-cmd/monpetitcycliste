
# Masquer les boutons "Total" et "General" pour les courses d'un jour

## Problème identifié

Pour les courses d'un jour (comme "Classica Camp de Morvedre" dans la capture), les boutons **Total** et **General** affichent les mêmes données car il n'y a qu'un seul classement. Ces boutons sont donc inutiles et encombrent l'interface.

## Logique actuelle

Le code distingue déjà les courses par étapes des courses d'un jour :

```tsx
// Ligne 221
const isStageRace = data.meta.etapes_disponibles?.length > 0;
```

Pour les courses d'un jour (`isStageRace === false`) :
- L'onglet "results" est affiché
- Les boutons "Total" + tous les types disponibles sont affichés

## Solution proposée

Pour les courses d'un jour, masquer les boutons de sélection de type si :
1. Il n'y a qu'un seul type de classement (ex: "General" uniquement)
2. Le bouton "Total" n'a pas d'intérêt car il afficherait la même chose

### Modification à apporter

**Fichier** : `src/components/courses/CourseResultsDrawer.tsx`

**Lignes 830-853** - Conditionner l'affichage des boutons de type :

```tsx
<TabsContent value="results" className="space-y-4 mt-4">
  {/* Type selector pills - Only show if multiple types */}
  {filteredTypes.length > 1 && (
    <div className="flex gap-2 flex-wrap">
      <Button ... >Total</Button>
      {filteredTypes.map((type) => (
        <Button key={type} ...>{type}</Button>
      ))}
    </div>
  )}
```

### Détection des types disponibles

Ajouter une variable pour identifier si le sélecteur est utile :

```tsx
// Dans le composant, calculer les types filtrés
const filteredTypes = (meta?.types_disponibles || [])
  .filter(type => !type.startsWith('Porteur'));

// Le sélecteur Total/General n'a de sens que si :
// 1. Il y a plusieurs types de classement (ex: General + Sprint + Montagne)
// 2. OU si c'est une course par étapes (Total agrège les étapes)
const showTypeSelector = filteredTypes.length > 1 || isStageRace;
```

Pour une course d'un jour avec un seul type "General" :
- `filteredTypes = ['General']`
- `showTypeSelector = false`
- On affiche directement le classement General sans boutons

---

## Récapitulatif des changements

| Élément | Avant | Après |
|---------|-------|-------|
| Boutons Total/General | Toujours affichés | Masqués si 1 seul type |
| Course d'un jour avec 1 type | 2 boutons inutiles | Affichage direct |
| Course avec Sprint + Montagne | Boutons visibles | Boutons visibles (inchangé) |

---

## Fichier impacté

| Fichier | Modification |
|---------|--------------|
| `src/components/courses/CourseResultsDrawer.tsx` | Ajouter condition pour masquer les boutons de type quand inutiles |
