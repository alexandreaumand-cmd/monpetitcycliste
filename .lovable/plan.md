
## Correction du tri des pronostics "En cours" vs "Passes"

### Probleme

Dans `PronosticsTab.tsx` ligne 45, la condition actuelle est :

```
if (!prono || (prono.is_correct !== null && prono.is_correct !== undefined)) {
  evaluated.push(d);  // -> "Passes"
}
```

Quand le manager n'a pas fait de pronostic (`!prono`), la deadline est mise dans "Passes" alors que les resultats n'ont pas encore ete saisis. Elle devrait etre dans "En cours".

### Solution

Modifier la logique de tri pour distinguer 3 cas :
1. **Le manager a un pronostic avec `is_correct` defini** (true ou false) -> Passes (evalue)
2. **Le manager a un pronostic avec `is_correct` a null** -> En cours (en attente d'evaluation)
3. **Le manager n'a pas fait de pronostic** -> Il faut verifier si l'evaluation a eu lieu. Pour cela, on va regarder si d'autres pronostics de la ligue pour cette meme deadline ont ete evalues (via une requete supplementaire ou en elargissant les donnees recuperees).

Approche retenue (la plus simple) : ajouter une colonne ou une verification cote serveur. Mais pour eviter un changement de schema, on va utiliser une approche pragmatique :

- Quand `!prono` : mettre dans **En cours** par defaut
- Quand `prono` existe et `is_correct !== null` : mettre dans **Passes**
- Quand `prono` existe et `is_correct === null` : mettre dans **En cours**

Cela signifie que si un manager n'a pas fait de pick et que l'evaluation a eu lieu, la deadline restera dans "En cours" au lieu de "Passes". Pour gerer ce cas, on ajoutera une verification via les `race_results` : si un resultat (position 1) existe pour cette course/etape/type, on considere la deadline comme evaluee.

### Fichier modifie

| Fichier | Modification |
|---------|-------------|
| `src/components/arena/PronosticsTab.tsx` | Corriger la logique de tri dans le `useMemo` |
| `src/hooks/useArenaPronostics.ts` | Ajouter un hook `useEvaluatedDeadlineIds` qui recupere les deadlines ayant un resultat en base |

### Details techniques

**Etape 1 - Hook `useEvaluatedDeadlineIds`** dans `useArenaPronostics.ts` :
- Prend la liste des `course_id` des deadlines closes
- Interroge `race_results` pour verifier si un gagnant (position = 1) existe pour chaque couple course/etape/type
- Retourne un Set d'identifiants de deadlines evaluees

**Etape 2 - Correction du tri** dans `PronosticsTab.tsx` :
- Remplacer la condition de la ligne 45 par :
  - Si `prono` existe et `is_correct !== null` -> evaluated (Passes)
  - Si le deadline id est dans le Set des deadlines evaluees (resultat disponible) -> evaluated (Passes)
  - Sinon -> pending (En cours)

Cela couvre correctement les cas :
- Manager a fait un pick, resultat arrive -> Passes (correct)
- Manager a fait un pick, resultat pas arrive -> En cours (correct)
- Manager n'a pas fait de pick, resultat arrive -> Passes (correct)
- Manager n'a pas fait de pick, resultat pas arrive -> En cours (correct, corrige le bug)
