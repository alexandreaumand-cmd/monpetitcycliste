# Pourquoi Kwiatkowski apparaît comme "Retiré"

## Diagnostic

Le badge **"Retiré"** vient du `startlist-tracker` : il a comparé un ancien import AuRA (où Kwiatkowski était présent) au dernier import (où il est absent). Or il est bien sur PCS (capture INEOS). Le problème vient du **filtre PDF whitelist** introduit au tour précédent.

Dans `supabase/functions/startlist-tracker/index.ts` :

1. `fetchPcsPdfWhitelist` lit le PDF PCS octet par octet (`String.fromCharCode(buf[i])`) puis retire les octets `\x00` et les caractères de contrôle `\u0001-\u0008`.
2. Les chaînes du PDF PCS sont en **UTF-16BE** : chaque caractère = 2 octets (poids fort + poids faible).
3. Pour les caractères ASCII (poids fort = `\x00`) ça marche. Mais pour `ł` (U+0142) = octets `0x01 0x42`, le code :
   - retire le `0x01` (rangé dans `\u0001-\u0008`)
   - garde le `0x42` = `B`
   - → "Michał" devient `"MichaB"` dans la whitelist.
4. Côté HTML, `normalizeRiderName` fait NFD + suppression des diacritiques, mais `ł` ne se décompose **pas** en NFD (caractère atomique). Le `replace(/[^A-Za-z]/, ' ')` le supprime → `"MICHA"`.
5. Whitelist contient `"KWIATKOWSKI MICHAB"`, HTML donne `"KWIATKOWSKI MICHA"` → **mismatch, Kwiatkowski filtré**.

Le même bug touche potentiellement tout coureur avec `ł, đ, ø, ß, Æ, Þ`, etc. (caractères Latin Extended hors plage Latin-1 et non décomposables en NFD).

## Plan

### `supabase/functions/startlist-tracker/index.ts`

**1. Décoder le PDF en UTF-16BE correctement** dans `fetchPcsPdfWhitelist` :

Pour chaque chaîne extraite de `(...) Tj` :
- D'abord déséchapper les séquences PDF (`\(`, `\)`, `\\`, `\n`, `\r`, `\t`).
- Travailler sur les octets bruts (pas sur une chaîne latin-1 où on a déjà perdu `0x01`).
- Détecter le préfixe BOM `FE FF` (présent dans les chaînes PCS UTF-16BE). Si présent, ou si la longueur est paire avec beaucoup d'octets `0x00` en position paire : appairer `(high<<8) | low` puis `String.fromCharCode(codepoint)`.
- Sinon traiter en Latin-1.

Concrètement : conserver l'extraction regex `/\(([\s\S]*?)\)\s*Tj/g` sur la version latin-1 brute (pour le matching), mais après match, re-décoder le contenu intérieur en pairant les octets. Résultat : `"Michał"` au lieu de `"MichaB"`.

**2. Étendre `normalizeRiderName`** pour gérer les caractères atomiques non décomposables (sécurité supplémentaire, indépendamment du fix PDF) :

```ts
const SPECIAL_MAP: Record<string, string> = {
  'ł': 'l', 'Ł': 'L', 'đ': 'd', 'Đ': 'D', 'ø': 'o', 'Ø': 'O',
  'ß': 'ss', 'æ': 'ae', 'Æ': 'AE', 'œ': 'oe', 'Œ': 'OE',
  'þ': 'th', 'Þ': 'TH', 'ð': 'd', 'Ð': 'D'
};
```
Appliqué avant le `NFD`. Garantit que les deux côtés (HTML et PDF) normalisent identiquement, même si le décodage PDF a une faille résiduelle.

**3. Conserver le filet de sécurité 40 %** (déjà en place) pour ne pas tout casser si le PDF est illisible.

### Nettoyage DB

Après déploiement :
- Supprimer l'import courant de la course AuRA (`startlist_id = a2661a65-1b59-4b30-9be8-69140de771d6`) côté `startlist_entries` + `startlist_imports`.
- Reset `last_tracker_check = NULL` sur la course `tour-auvergne-rhone-alpes-mj6w48yf` pour forcer un nouveau scrape qui inclura Kwiatkowski et les autres coureurs à diacritiques particulières.

## Hors scope

- `startlist-import` (collage texte manuel)
- UI, logique de matching, scoring
- Les autres "Retirés" légitimes (vraies sorties de startlist) restent intacts
