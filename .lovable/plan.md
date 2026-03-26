

## Fermer le round 4 de la ligue "test saison entière 3 managers"

### Constat
- Le round 4 (auction `7302ff6e-5b96-4ebf-ab5f-ba983ae940b8`) est `open` mais **aucun bid n'a été posé**
- Les 3 managers ont déjà 30/30 coureurs — le round est vide
- L'edge function `clore-round` nécessite une authentification (tu n'es pas connecté sur le preview)

### Solution : migration SQL pour fermer le round

```sql
UPDATE auctions
SET statut = 'closed',
    closed_at = NOW()
WHERE id = '7302ff6e-5b96-4ebf-ab5f-ba983ae940b8'
  AND statut = 'open';
```

### Alternative
Te connecter sur le preview en tant qu'admin de cette ligue et cliquer sur "Clôturer le round" depuis l'interface.

### Fichier impacté
- 1 migration SQL uniquement

