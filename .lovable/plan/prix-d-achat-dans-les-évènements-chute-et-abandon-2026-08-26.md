# Prix d'achat dans les évènements Chute et Abandon

## Objectif

Dans la Timeline live, pour les évènements de type **Chute** et **Abandon** uniquement, afficher le prix payé aux enchères par le manager propriétaire, à côté du nom du coureur :

`💥 Chute de Wout Van Aert (Matt B) — acheté 551M — à 42 km`

## Pourquoi côté affichage (et pas dans le texte publié)

Un évènement live est publié une seule fois pour toutes les ligues diffusées : le message est commun, alors que le manager et le prix d'achat dépendent de la ligue et de la phase. Le nom du manager est déjà résolu à l'affichage à partir des rosters de la ligue et de la phase de la course. Le prix suivra exactement le même chemin, ce qui garantit la bonne valeur dans chaque ligue (MPC 2026 phase 5, CopaVuelta, etc.) sans dupliquer les messages.

## Ce qui change

1. La récupération des propriétaires de coureurs de la ligue rapporte désormais aussi le prix payé (`prix_signature`) en plus du nom du manager.
2. Dans les messages de la Timeline, quand l'évènement est une chute ou un abandon et que le coureur appartient à un manager de la ligue, le prix est affiché après le nom du manager (format `acheté 551M`). Si le prix est inconnu, on affiche comme aujourd'hui, sans prix.
3. Les autres types d'évènements (relais, attaque, position, voiture d'équipe, etc.) restent inchangés, pour ne pas alourdir la timeline.

## Détails techniques

- `src/hooks/useArenaMessages.ts` — `useLeagueRosterOwners` : la requête `rosters` sélectionne aussi `prix_signature` et la map retournée devient `Record<coureur_id, { name: string; prix: number | null }>`.
- `src/components/arena/MessageBubble.tsx` — le rendu des mentions `{Coureur}` accepte la nouvelle forme de map, et ajoute le suffixe prix uniquement si `metadata.live_event_type` vaut `crash` ou `abandon`.
- Adapter les consommateurs de la map à la nouvelle forme : `TrashTalkTab.tsx`, `LiveCoursesTab.tsx`, `LiveCoursePanel.tsx`, `RaceSituationDisplay.tsx`, `RaceSituationEditor.tsx` (ces derniers continuent d'afficher seulement le nom du manager).
- Aucune modification de base de données ni d'Edge Function.
