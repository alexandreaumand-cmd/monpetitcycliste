

## Corriger le filtrage league dans `get-rider-points-table`

### Cause racine
La fonction edge `get-rider-points-table` crée son client Supabase **sans le header Authorization** de l'utilisateur (ligne 14). Le client est donc "anonyme".

Quand il appelle `supabase.rpc('get_league_course_ids', ...)`, la fonction SQL (qui est `SECURITY INVOKER`) exécute une requête sur `league_scopes`, mais les politiques RLS de cette table exigent soit `is_league_member()` soit une ligue publique. Un client anonyme échoue silencieusement → la liste de courses retournée est **vide** → `leagueCourseIds` reste `null` → **aucun filtre n'est appliqué** → tous les points sont renvoyés.

En comparaison, `manager-my-team` passe bien le header Authorization au client, ce qui permet à RLS de fonctionner.

### Correction
**Fichier** : `supabase/functions/get-rider-points-table/index.ts`

Modifier la création du client Supabase (ligne 14) pour inclure le header Authorization, exactement comme dans `manager-my-team` :

```typescript
// Avant (ligne 14)
const supabase = createClient(supabaseUrl, supabaseKey);

// Après
const supabase = createClient(supabaseUrl, supabaseKey, {
  global: {
    headers: { Authorization: authHeader },
  },
});
```

Et déplacer la récupération de `authHeader` **avant** la création du client (actuellement aux lignes 17-18, la déplacer avant la ligne 14).

### Résultat attendu
- Noa Isidore dans "Flandriennes 2026" : **0 point** (la Volta est correctement exclue)
- Aucune régression pour les autres ligues ou le mode sans ligue

### Fichier impacté
- `supabase/functions/get-rider-points-table/index.ts` (une seule modification)

