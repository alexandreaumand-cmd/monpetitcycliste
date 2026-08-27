# Chutes collectives : préciser le groupe et l'accord

## Constat vérifié

L'évènement PCS « Crash by 2 riders in peloton » est déjà pris en charge : le dernier message publié en base est bien groupé — `⚠️ Chute de {BRENNER Marco} et {MADOUAS Valentin} — à 83 km` — et une notification individuelle est envoyée à chaque manager propriétaire.

Deux imprécisions restent sur ce type de ligne :
- le groupe mentionné par PCS (« in peloton », « in first chase group ») n'est pas extrait pour les chutes, contrairement aux attaques/accélérations ;
- le libellé ne marque pas le pluriel quand plusieurs coureurs tombent.

## Ce qui change

Le message deviendra, selon le cas :
- un coureur : `⚠️ Chute de {X} dans le peloton — à 83 km`
- plusieurs coureurs : `⚠️ Chutes de {X} et {Y} dans le peloton — à 83 km`

Le nombre annoncé par PCS (« by 2 riders ») n'est pas repris tel quel : ce sont les noms réellement listés qui sont affichés, avec le nom du manager quand le coureur appartient à un roster.

Aucun changement sur les notifications (déjà une par coureur et par manager) ni sur l'interface.

## Détails techniques

**`supabase/functions/scrape-live-race/index.ts`**
- Dans `classifyLiveText`, pour la branche `crash`, extraire le libellé de groupe via `grp(/\bin\s+(?:the\s+)?(.+?)(?:[.,]|$)/i)` et le renvoyer dans `group_label` (le reste de la détection reste inchangé, y compris la priorité `abandon` avant `crash`).

**`supabase/functions/live-broadcast-auto-scrape/index.ts`**
- Dans `formatLiveEvent`, cas `crash` : utiliser `Chutes` au pluriel quand `many` est vrai et suffixer `` dans${grp} `` quand `group_label` est présent, avant le suffixe kilométrique.

Le dédoublonnage existant (clé type + coureurs + km) et le tri chronologique restent inchangés ; les deux fonctions seront redéployées.
