

## Fix : le dernier coureur de chaque groupe n'est pas détecté par le parser fallback

### Cause racine

Dans le parser texte fallback (ligne 331), la regex d'extraction des coureurs utilise un lookahead strict :
```
(?=\s+\d{1,2}\s+\d{1,3}\s+[A-Z...]|\s*$)
```

Le `\s*$` exige que le texte se termine proprement après le dernier coureur. Or le texte PCS contient des caractères Unicode (drapeaux emoji rendus en `??`) après chaque nom. Résultat : le lookahead échoue pour le **dernier coureur de chaque groupe**, d'où "Head of the race: 1 rider" au lieu de 2 (VAN AERT Wout est ignoré).

Les logs confirment : `Fallback group "Head of the race": 1 riders parsed` alors que le texte contient bien `1 21 VAN DER POEL Mathieu 2 141 VAN AERT Wout`.

### Changement dans `supabase/functions/scrape-live-race/index.ts`

**Ligne 331** — Remplacer le lookahead trop strict par une version permissive qui accepte aussi des caractères non-alphanumériques en fin de chaîne :

```typescript
const riderRx = /(\d{1,2})\s+(\d{1,3})\s+([A-ZÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞŸ][A-ZÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞŸa-zàáâãäåæçèéêëìíîïðñòóôõöøùúûüýþÿ \u0027'-]+[a-zàáâãäåæçèéêëìíîïðñòóôõöøùúûüýþÿ]+)(?=\s+\d{1,2}\s+\d{1,3}\s+[A-ZÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞŸ]|[^A-Za-z0-9]*$)/g;
```

Seul changement : `\s*$` → `[^A-Za-z0-9]*$` pour tolérer les `??` et autres caractères non-alphanumériques en fin de groupe.

### Fichier impacté
- `supabase/functions/scrape-live-race/index.ts`

