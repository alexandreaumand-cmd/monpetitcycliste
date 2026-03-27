

## Fix du parser L'Équipe pour capturer tous les groupes de course

### Problème
Le parser L'Équipe dans `scrape-live-race` ne détecte que 2 types de groupes : `"Groupe de tête"` et `"Peloton"` (ligne 198). Or L'Équipe utilise des noms variés comme :
- **Échappée** (breakaway)
- **Poursuivants** (chasers avec gap)
- **Noms de coureurs individuels** (ex: "Garcia Cortina" avec gap)
- **Contre**, **Maillot jaune**, etc.

La regex `/(Groupe\s+de\s+t[êe]te|Peloton)\s*/` est trop restrictive et ignore tous ces groupes.

### Solution — `supabase/functions/scrape-live-race/index.ts`

Refactorer la détection des groupes dans `parseLEquipeLive` :

1. **Élargir la regex des groupes** pour capturer les patterns L'Équipe courants :
   - `Échappée`, `Poursuivants`, `Contre`, `Peloton`, `Groupe de tête`, `Groupe de chasse`, `Maillot jaune/vert/etc.`
   - Pattern individuel : nom de coureur suivi d'un gap (`Garcia Cortina | +02'16"`)

2. **Nouvelle approche** : Au lieu de matcher uniquement des mots-clés fixes, détecter les sections structurées du HTML L'Équipe. L'Équipe structure ses groupes avec un pattern :
   - Nom du groupe (texte bold/header)
   - Optionnel : `|` ou séparateur + gap
   - Liste de coureurs avec drapeaux et équipes

3. **Concrètement**, remplacer le `groupHeaderPattern` par une regex plus large :
```typescript
// Capture: Échappée, Poursuivants, Peloton, Groupe de X, Contre,
// ou un nom propre (ex: "Garcia Cortina") suivi d'un gap
const groupHeaderPattern = /(Échapp[ée]e|Poursuivants?|Peloton|Groupe\s+de\s+\w+|Contre|Maillot\s+\w+|[A-ZÀ-Ü][a-zà-ü]+(?:\s+[A-ZÀ-Ü][a-zà-ü]+)*)\s*(?:[|·\s]*(?:[àa]\s*)?(?:\+?\s*)(\d{1,3})\s*[':′''min]\s*(\d{1,2})\s*[":″''s]?\s*[":″''s]?)?/gi;
```

4. **Filtrer les faux positifs** : exclure les matches qui ressemblent à des noms de coureurs dans la liste (trop courts, pas suivis d'un gap, etc.) en vérifiant que chaque header est soit un mot-clé connu, soit un nom suivi d'un gap structuré.

5. **Garder la logique existante** intacte pour l'extraction des coureurs dans chaque section et l'enrichissement avec riderIds.

### Fichier impacté
- `supabase/functions/scrape-live-race/index.ts` — refactoring du `groupHeaderPattern` dans `parseLEquipeLive`

