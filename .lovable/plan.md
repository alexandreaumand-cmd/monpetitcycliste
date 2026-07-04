# Ajouter le mode TTT à la saisie de résultats sur mobile

## Constat

Sur desktop (`src/components/admin/ResultsEntryStudio.desktop.tsx`), la saisie propose une case à cocher **TTT** + un champ **Nb coureurs** (1‑10) qui bascule la grille en mode équipes (positions 1‑10 par équipe, coureurs répartis dedans, points calculés au prorata).

Sur mobile (`src/components/admin/ResultsEntryStudio.mobile.tsx`), rien de tout cela n'existe : aucun état `isTTT`, aucun sélecteur d'équipe, aucune persistance de `is_ttt` / `ttt_riders_count`. On ne peut donc pas déclarer une étape/course comme TTT depuis un téléphone.

## Objectif

Atteindre la parité fonctionnelle du mode TTT entre mobile et desktop, sans toucher au desktop ni à la logique backend (les tables `race_result_sets.is_ttt/ttt_riders_count` et `course_stage_config.is_ttt` existent déjà et sont utilisées par le calcul des points).

## Changements (frontend uniquement)

### 1. `src/components/admin/ResultsEntryStudio.mobile.tsx`

- **État** : ajouter `isTTT`, `tttRidersCount` (défaut 7), et une ref `tttManuallySet` — même sémantique que desktop (empêche la lecture DB d'écraser un choix utilisateur en cours d'édition).
- **Chargement (`loadResults`)** :
  - Élargir la lecture de `race_result_sets` pour inclure `is_ttt, ttt_riders_count`.
  - Si `!tttManuallySet.current`, hydrater `isTTT` / `tttRidersCount` depuis la ligne trouvée.
  - Si `is_ttt` en DB : reconstruire la grille par équipe (grouper les `race_results` par `equipe_id`, positions 1‑10, coureurs rangés par `position_decimal`) exactement comme desktop l.376‑410.
- **Réinitialisation** : quand l'étape ou l'onglet de classement change réellement, remettre `isTTT` à `false` et vider la grille (miroir de desktop l.242‑253).
- **UI** : dans le header de la section de saisie (à côté de la case *Annulée*), ajouter :
  - Checkbox **TTT** visible uniquement pour `classement === "Etape"` ou pour une One‑Day sur l'onglet finals.
  - Input numérique **Nb coureurs** (1‑10) affiché quand `isTTT` est coché.
  - Toute bascule met `tttManuallySet.current = true`, `isDirty = true` et vide la grille.
- **Grille TTT** : nouveau bloc de rendu (utilisé quand `isTTT`) affichant 10 lignes « équipe » avec un `EquipeCombobox` + zone repliable listant `tttRidersCount` `CoureursCombobox` (position_decimal `pos + i/10`). Réutiliser `useResultRows` (`handleTeamChange`, `handleToggleExpand`, `handleTeamRiderChange`) déjà prévus pour ce mode.
- **Sauvegarde** : dans le flux existant de save,
  - upsert `race_result_sets` avec `is_ttt` et `ttt_riders_count` (null si TTT off),
  - upsert `course_stage_config` avec `is_ttt: true` et `ttt_riders_count` quand TTT est actif sur une étape,
  - en mode TTT, insertion directe dans `race_results` avec `equipe_id` + `position_decimal` (au lieu du chemin classique top‑N), calqué sur desktop l.752‑790,
  - `validLinesCount` compte les coureurs présents dans les `team_riders` quand TTT.
- Après un save réussi, remettre `tttManuallySet.current = false`.

### 2. Aucun changement backend

Les tables, RPC de scoring et edge functions gèrent déjà le TTT (utilisés par la version desktop). On se contente d'envoyer les mêmes payloads.

## Hors périmètre

- Pas de refonte visuelle du composant mobile.
- Pas de modification de `ResultsEntryStudio.desktop.tsx`, du hook `useResultRows`, ni des fonctions Supabase.
- Pas de changement sur la lecture des résultats (drawers, classements) — déjà compatibles TTT.

## Vérification

1. Sur mobile, ouvrir une étape → cocher TTT, saisir 8 coureurs, choisir 10 équipes + coureurs, sauvegarder → recharger et vérifier que la grille revient bien en mode TTT.
2. Décocher TTT sur une étape existante → la grille repasse en top‑N classique et `is_ttt` repasse à `false` en DB.
3. Sur desktop, rouvrir la même étape et confirmer que le mode TTT + `tttRidersCount` sont identiques à ce qui a été saisi depuis le mobile.
