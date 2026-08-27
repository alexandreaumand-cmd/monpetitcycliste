# Deux évènements PCS : « Reaction from » et « Acceleration in peloton by »

## Constat vérifié

- **Acceleration in peloton by POGAČAR Tadej** : déjà pris en compte. `classifyLiveText` détecte `/\bacceleration\b/` et le message publié est `⚡ Accélération de {POGAČAR Tadej} dans le peloton — à X km`.
- **Reaction from ONLEY / ROGLIČ / MAS** : **non pris en compte**. Aucune règle de `classifyLiveText` ne reconnaît « Reaction from … » ; la ligne est donc ignorée et n'apparaît jamais dans la timeline.

## Ce qui change

Nouveau type d'évènement « réaction », multi-coureurs comme les autres :

- un coureur : `↩️ Réaction de {ROGLIČ Primož} — à 83 km`
- plusieurs coureurs : `↩️ Réaction de {ONLEY Oscar}, {ROGLIČ Primož} et {MAS Enric} — à 83 km`
- si PCS précise un groupe (« in peloton »), il est ajouté : `… dans le peloton`

Le nom du manager propriétaire s'affiche automatiquement à côté du coureur possédé dans la ligue. Aucune notification personnalisée pour ce type (réservées aux chutes, abandons et victoires réelles).

## Détails techniques

**`supabase/functions/scrape-live-race/index.ts`**
- Ajouter `"reaction"` à `LiveTextEventType`.
- Dans `classifyLiveText`, ajouter avant la règle `acceleration` :
  `if (/\breaction\s+(from|by)\b/i.test(t)) return { type: "reaction", group_label: grp(/\bin\s+(?:the\s+)?(.+?)(?:[.,]|$)/i) };`

**`supabase/functions/live-broadcast-auto-scrape/index.ts`**
- Ajouter `"reaction"` à l'union de types de `LiveEvent`.
- Dans `formatLiveEvent` : `case "reaction": return \`↩️ Réaction de ${rider}${grp ? \` dans${grp}\` : ""}${km}\`;`

Le dédoublonnage (type + coureurs + km) et le tri chronologique existants s'appliquent automatiquement. Les deux fonctions seront redéployées. Aucun changement d'UI ni de base de données.
