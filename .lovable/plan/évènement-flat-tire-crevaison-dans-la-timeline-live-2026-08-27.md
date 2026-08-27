# Évènement « Flat tire » (crevaison) dans la timeline live

## Constat vérifié

Non, cet évènement n'est **pas** pris en compte. Dans `classifyLiveText` (`supabase/functions/scrape-live-race/index.ts`), seule la formulation `mechanical problem/issue` est détectée. Une ligne PCS « Flat tire for CORT Magnus (Uno-X Mobility) in peloton » n'est classifiée par aucune règle et est donc ignorée.

## Ce qui change

La crevaison devient un évènement de la timeline, avec le groupe mentionné par PCS et le nom du manager propriétaire quand le coureur appartient à un roster :

- un coureur : `🛞 Crevaison pour {CORT Magnus} dans le peloton — à 83 km`
- plusieurs coureurs : `🛞 Crevaison pour {X} et {Y} dans le peloton — à 83 km`

Aucune notification personnalisée n'est ajoutée (les notifications restent réservées aux chutes, abandons et victoires), et l'interface n'est pas modifiée.

## Détails techniques

**`supabase/functions/scrape-live-race/index.ts`**
- Ajouter `"flat_tire"` au type `LiveTextEventType`.
- Dans `classifyLiveText`, avant la règle `mechanical`, ajouter :
  `if (/\b(flat tire|flat tyre|puncture[ds]?|punctures)\b/i.test(t)) return { type: "flat_tire", group_label: grp(/\bin\s+(?:the\s+)?(.+?)(?:[.,]|$)/i) }`.
  L'extraction des coureurs et du kilométrage réutilise le mécanisme existant (mêmes règles que `mechanical`, y compris les listes de plusieurs coureurs).

**`supabase/functions/live-broadcast-auto-scrape/index.ts`**
- Ajouter `"flat_tire"` à l'union de types de `LiveEvent`.
- Dans `formatLiveEvent`, ajouter le cas :
  `case "flat_tire": return \`🛞 Crevaison pour ${rider}${grp ? \` dans${grp}\` : ""}${km}\`;`

Le dédoublonnage (type + coureurs + km) et le tri chronologique existants s'appliquent automatiquement. Les deux fonctions seront redéployées.
