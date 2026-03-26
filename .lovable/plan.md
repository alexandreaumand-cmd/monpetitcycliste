

## Nettoyer les données orphelines d'Alex dans la ligue TEST

### Contexte
- **Alex** (manager `2a0740db`) n'est **pas membre** de la ligue mais possède 18 roster entries + 30 bids
- Les 3 vrais membres (Ludo, Alex le Desk, LudoTEST10) ont déjà 30/30 coureurs chacun

### Actions (données uniquement, pas de code)

**1. Supprimer les 18 roster entries d'Alex**
```sql
DELETE FROM rosters 
WHERE manager_id = '2a0740db-b240-4278-b801-5b0525c282e8' 
AND league_id = 'edb66d34-826e-435b-b033-b70ee36972aa';
```

**2. Supprimer les 30 bids d'Alex**
```sql
DELETE FROM bids 
WHERE manager_id = '2a0740db-b240-4278-b801-5b0525c282e8' 
AND league_id = 'edb66d34-826e-435b-b033-b70ee36972aa';
```

**3. Supprimer les annonces liées aux bids d'Alex** (si existantes)
Vérifier et nettoyer les annonces associées.

### Résultat attendu
- Alex disparaît complètement de la ligue
- Les 3 membres restants (Ludo, Alex le Desk, LudoTEST10) gardent leurs 30/30 coureurs
- Aucun changement de code nécessaire

