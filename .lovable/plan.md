# Nouveaux évènements du livetext PCS dans la Timeline

Ajout de 7 nouveaux types d'évènements extraits du livetext de ProCyclingStats, plus la prise en charge des évènements concernant **plusieurs coureurs à la fois** (ce que le parseur actuel ne gère pas : il ne lit que le premier coureur de la ligne).

## Évènements ajoutés

| Texte PCS | Message Timeline |
|---|---|
| `X is dropped from first chase group` | 🪃 {X} est décroché du premier groupe de chasse |
| `X and Y join first chase group` | 🤝 {X} rejoint le premier groupe de chasse |
| `Counter attack by X in peloton` | 🔁 Contre-attaque de {X} dans le peloton |
| `Acceleration in peloton by X, Y` | ⚡ Accélération de {X} dans le peloton |
| `Attack by 2 riders in peloton` (+ liste) | 🚀 Attaque de {X} dans le peloton |
| `X is struggling to hold on` | 😣 {X} est en difficulté pour s'accrocher |
| `X caught by peloton` | 🎯 {X} est repris par le peloton |

Le nom du groupe mentionné par PCS (peloton, premier groupe de chasse, échappée…) est reprisdans le message quand il est présent. Comme aujourd'hui, chaque coureur est affiché avec le nom de son manager quand il appartient à un roster de la ligue.

## Évènements multi-coureurs

Les lignes du type « Attack by 2 riders in peloton » ou « Acceleration in peloton by A, B » listent plusieurs coureurs. Chacun donnera lieu à une entrée distincte dans la Timeline (une par coureur trouvé), afin que chaque manager voie son coureur cité. Les coureurs non rattachés à un roster restent affichés sans mention de manager.

## Détails techniques

**`supabase/functions/scrape-live-race/index.ts`**
- Étendre `LiveTextEventType` avec : `dropped`, `join_group`, `counter_attack`, `acceleration`, `struggling`, `caught`, et conserver `attack`.
- Dans `classifyLiveText`, ajouter les motifs correspondants, en respectant l'ordre de priorité (ex. `counter attack` avant `attack`, `is dropped` avant les autres) et extraire le libellé de groupe (`in peloton`, `from/join first chase group`, `by peloton`) dans un champ `group_label`.
- Dans `parsePCSLiveText`, remplacer la lecture du seul premier `a[href*='rider/']` par la collecte de **tous** les liens coureurs du bloc `div.textCont`, et émettre un `LiveTextEvent` par coureur. L'`uid` devient `<uid>#<slug>` pour préserver le dédoublonnage par coureur (le dédoublonnage existant côté diffusion reste inchangé).
- Ajouter `group_label` à l'interface `LiveTextEvent` ; la résolution `coureur_id` / `manager_name` reste identique et s'applique à chaque évènement produit.

**`supabase/functions/live-broadcast-auto-scrape/index.ts`**
- Étendre le type `LiveEvent` avec les nouveaux types et `group_label`.
- Compléter `formatLiveEvent` avec les libellés français ci-dessus et l'insertion du groupe.
- Conserver le tri chronologique (km restants décroissants) et l'horodatage échelonné déjà en place, ainsi que le plafond `MAX_LIVE_EVENTS_PER_RUN` (à relever légèrement, de 10 à 20, car les évènements multi-coureurs multiplient le volume).

**Interface** : aucun changement nécessaire — la Timeline affiche déjà les messages `admin_broadcast` avec leurs mentions coureurs et le nom du manager.
