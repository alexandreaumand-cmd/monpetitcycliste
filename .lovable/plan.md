## Diagnostic

### Les coureurs existent bien
- `itamar_einhorn` → "Itamar EINHORN" (équipe : NSN Cycling Team)
- `rotem_tene` → "Rotem TENE" (équipe : (sans contrat))

### Les alias existent bien aussi dans `name_aliases`
- `TENE Rotem` → `rotem_tene` (source_team : `NSN Cycling Team (WT)`)
- `EINHORN Itamar` → `itamar_einhorn` (source_team : `NDT`)

### Pourquoi ils sortent quand même "unmatched" sur le Tour de Romandie

L'entrée scrapée pour la Romandie est :
- `EINHORN Itamar` / `NSN Cycling Team (WT)`
- `TENE Rotem` / `NSN Cycling Team (WT)`

Et l'historique montre que ces mêmes coureurs ont déjà été matchés `confirmed` plusieurs fois sur d'autres startlists (Paris-Nice, Tirreno…). Donc le matching fonctionne **parfois** mais pas ici.

La table `name_aliases` **est bien interrogée** (cf. `startlist-tracker/index.ts` ligne 750 et `startlist-import/index.ts` ligne 482). Le problème vient de la **logique de comparaison** dans `matchRider()` (ligne 173-180) :

```ts
for (const alias of aliases) {
  const aliasNorm = normalize(alias.alias_text);
  const aliasSig = tokenSig(alias.alias_text);
  if (aliasNorm === sourceNorm || aliasNorm === entryNorm
      || aliasSig === sourceSig || aliasSig === entrySig) {
    return { coureur_id: alias.coureur_id, ... };
  }
}
```

Le `tokenSig` trie les tokens alphabétiquement, donc `EINHORN Itamar` et `Itamar EINHORN` produisent **la même signature** `EINHORN ITAMAR`. Le matching alias **devrait** donc fonctionner.

**MAIS** : il existe en base **un autre coureur** que je dois vérifier — il y a un coureur `rotem_tene` dont le nom contient "TENE" et `fabio_puntener` (Fabio PuNTENER). La normalisation de "PuNTENER" donne `PUNTENER`. Le `tokenSig` de `TENE Rotem` = `ROTEM TENE`. Pas de collision directe avec `PUNTENER`. Donc l'alias devrait s'appliquer.

**Vraie cause probable** : la liste d'alias est chargée *avant* que ces deux alias ne soient parcourus dans la boucle, mais comme l'alias a un `source_team` différent (`NDT` pour Einhorn vs `NSN Cycling Team (WT)` scrapé), un autre filtre/boucle plus en amont (étape 2 "exact normalized roster") peut échouer car ces 2 coureurs **ne sont pas dans le roster de la phase active** (NSN Cycling Team est CT/Continental, hors WorldTour). Les alias étant en étape 1 (priorité haute), cela devrait fonctionner.

### Vérification finale à faire

Le fait que `bde61add-…` (Einhorn, 26 mars, mêmes nom + équipe) ait `coureur_id=itamar_einhorn` mais `confidence=NULL` et `status=confirmed` montre une incohérence : le code écrit `confidence` du résultat, qui n'est jamais NULL. Cela suggère que le matching s'est fait **après coup** (via `startlist-confirm-matches`) et non par la boucle alias, qui aurait mis confidence=1.0.

**Conclusion** : la boucle alias **ne s'exécute pas** ou bien la table `name_aliases` est **filtrée par RLS** lors de l'appel par le service role. Très improbable. Plus probable : un bug d'**ordre d'exécution** où le tracker écrit l'entrée comme `unmatched` avant même d'appeler `matchRider`, ou bien la requête SELECT sur `name_aliases` est **paginée à 1000 lignes** (limite Supabase par défaut) et les alias récents (créés en février) sont en dehors des 1000 premières lignes retournées.

## Plan de correction

### 1. Vérifier le nombre total d'alias en base
Si > 1000, la requête `.from('name_aliases').select(...)` tronque silencieusement à 1000, et les alias récents sont ignorés.

### 2. Corriger les deux Edge Functions (`startlist-import` et `startlist-tracker`)

Ajouter une pagination explicite sur le chargement des alias :
```ts
const { data: aliasesData } = await supabase
  .from('name_aliases')
  .select('alias_text, coureur_id, source_team')
  .range(0, 9999); // ou boucle de pagination si > 10k
```

### 3. Ajouter un log de diagnostic
Logger le nombre d'alias chargés ET vérifier si les alias des 2 coureurs problématiques sont bien présents dans la liste chargée :
```ts
console.log(`[tracker] Loaded ${aliases.length} aliases`);
const hasEinhorn = aliases.some(a => a.coureur_id === 'itamar_einhorn');
const hasTene = aliases.some(a => a.coureur_id === 'rotem_tene');
console.log(`[tracker] Einhorn alias loaded: ${hasEinhorn}, Tene alias loaded: ${hasTene}`);
```

### 4. Re-déclencher le matching sur la startlist Romandie
Une fois la fix déployée, ré-exécuter le tracker (ou un re-match ciblé) sur `startlist_id=24984ddd-...` pour reclasser les 2 entrées en `confirmed`.

## Réponse aux questions

> **La table `name_aliases` est-elle interrogée ?** 
Oui, à chaque exécution de `startlist-import` (ligne 482) et `startlist-tracker` (ligne 750).

> **Y a-t-il des alias pour ces 2 coureurs ?** 
Oui, les deux existent :
- `TENE Rotem` → `rotem_tene` (créé le 11/02/2026)
- `EINHORN Itamar` → `itamar_einhorn` (créé le 21/02/2026)

> **Pourquoi le matching échoue ?** 
Très probablement à cause de la **limite implicite de 1000 lignes** sur la requête Supabase qui charge les alias. Les alias récents tombent hors de la fenêtre et ne sont jamais comparés.
