

## Masquer les saisons passées lors de la création d'une ligue

### Problème
Le sélecteur de saison dans le dialog de création de ligue affiche toutes les saisons (2024, 2025, 2026), alors que seule la saison en cours (2026) devrait être proposée.

### Solution
Filtrer la requête dans `CreateLeagueDialog.tsx` pour ne retourner que les saisons dont `annee >= année courante`.

### Modification

**`src/components/leagues/CreateLeagueDialog.tsx`** (ligne 81-84)

Ajouter un filtre `.gte('annee', new Date().getFullYear())` à la requête :

```typescript
const { data, error } = await supabase
  .from('saisons')
  .select('id, annee')
  .gte('annee', new Date().getFullYear())
  .order('annee', { ascending: false });
```

### Résultat attendu
- Seule "Saison 2026" apparaît dans le sélecteur (screenshot : les saisons 2024 et 2025 disparaissent)
- Aucun impact sur les ligues existantes

