# Sprint intermédiaire ≠ victoire d'étape

## Constat vérifié

Dans `supabase/functions/scrape-live-race/index.ts`, la classification des victoires est trop large :

```
if (/\bwins!?\s*$/i.test(t) || /\bwins\b/i.test(t)) return { type: "win" };
```

Toute ligne PCS contenant « wins » devient une victoire d'étape. La ligne « VAN AERT Wout (Team Visma | Lease a Bike) wins the Sprint | Benicàssim (120.1 km) » — à 57 km de l'arrivée — a donc été publiée comme « 🥇 VAN AERT Wout s'impose ! » et a déclenché la notification « Bravo ! Ton coureur a gagné ! ».

## Ce qui change

Un sprint intermédiaire devient son propre évènement, sans notification :

- `🏅 {VAN AERT Wout} remporte le sprint intermédiaire (Benicàssim) — à 57 km`

Une vraie victoire (`🥇 … s'impose !` + notification au manager) n'est retenue que lorsque la ligne est bien une arrivée : pas de kilométrage restant sur la ligne PCS, et pas de mention de sprint intermédiaire.

Les notifications restent limitées aux chutes, abandons et victoires réelles ; les sprints intermédiaires n'en génèrent aucune.

## Détails techniques

**`supabase/functions/scrape-live-race/index.ts`**
- Ajouter `"intermediate_sprint"` à `LiveTextEventType`.
- Dans `classifyLiveText`, remplacer la règle actuelle par :
  - `if (/\bwins\b[^.]*\bsprint\b/i.test(t) || /\bintermediate sprint\b/i.test(t)) return { type: "intermediate_sprint", group_label: undefined }` — capter aussi le lieu via `/\bsprint\s*\|\s*([^(]+?)\s*(?:\(|$)/i` renvoyé dans `group_label`.
  - sinon `if (/\bwins\b/i.test(t)) return { type: "win" }`.
- Dans `parsePCSLiveText`, après le calcul de `kmToGo` : si `classified.type === "win"` et `kmToGo != null && kmToGo > 0`, rétrograder en `intermediate_sprint` (garde-fou générique pour les autres formulations PCS de sprint/points en course).

**`supabase/functions/live-broadcast-auto-scrape/index.ts`**
- Ajouter `"intermediate_sprint"` à l'union de types de `LiveEvent`.
- Dans `formatLiveEvent` :
  `case "intermediate_sprint": return \`🏅 ${rider} remporte le sprint intermédiaire${ev.group_label ? \` (${ev.group_label})\` : ""}${km}\`;`
- Le filtre des notifications (`crash | abandon | win`) reste inchangé : aucune notification pour ce nouveau type.

**Nettoyage des données erronées**
- Supprimer le message d'arène « 🥇 VAN AERT Wout s'impose ! » de l'étape en cours ainsi que la notification `rider_win` correspondante, afin que la timeline et le centre de notifications ne conservent pas l'information fausse.

Les deux fonctions seront redéployées après modification.
