# Évènement « Problème mécanique » dans la Timeline live

## Constat

Vérifié dans le code du parseur livetext (`classifyLiveText`) : aucun motif ne reconnaît `Mechanical problem for X in peloton`. L'évènement est donc ignoré aujourd'hui et n'apparaît jamais dans la Timeline.

## Ce qui sera ajouté

Nouveau type d'évènement `mechanical` :

| Texte PCS | Message Timeline |
|---|---|
| `Mechanical problem for VINE Jay (UAE Team Emirates - XRG) in peloton` | 🔩 Problème mécanique pour {VINE Jay} dans le peloton — à 160 km |

- Le groupe mentionné (`in peloton`, `in first chase group`…) est repris dans le message quand il est présent.
- Multi-coureurs géré comme les autres évènements (un seul message groupé).
- Le nom du manager s'affiche automatiquement à côté du coureur possédé dans la ligue.
- Pas de notification personnalisée pour ce type (réservé chute / abandon / victoire).

## Détails techniques

- `supabase/functions/scrape-live-race/index.ts` : ajouter `mechanical` à `LiveTextEventType` et un motif dans `classifyLiveText` (`/mechanical (problem|issue)/i`) avec extraction du `group_label` via `\bin\s+(?:the\s+)?(.+?)$`. Placer la règle avant les règles génériques (`pulling`, `position`).
- `supabase/functions/live-broadcast-auto-scrape/index.ts` : ajouter `mechanical` au type `LiveEvent` et le libellé correspondant dans `formatLiveEvent`.
- Redéploiement des deux fonctions.

Aucun changement d'UI ni de base de données.
