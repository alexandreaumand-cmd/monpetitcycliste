

# Plan: Ajout du sélecteur d'étape au Live Broadcast

## Contexte
- Le broadcast copie déjà les messages (y compris la situation de course avec metadata) dans toutes les ligues via le RPC `arena_broadcast_live_message` — rien à changer côté copie.
- Il manque la notion d'**étape** : l'admin doit pouvoir choisir l'étape qu'il commente en live, et les users doivent pouvoir filtrer par étape.

## Changements

### 1. `src/pages/admin/SuperAdminLiveBroadcastPage.tsx` — Ajouter sélecteur d'étape
- Quand une course est sélectionnée, afficher un **sélecteur d'étape** (input numérique ou dropdown)
- Stocker `etape_numero` dans le state
- Passer `etape_numero` dans la metadata de chaque message broadcasté : `{ ...metadata, etape_numero }`
- La situation de course inclut aussi `etape_numero`
- L'historique se filtre par étape sélectionnée
- Pour les courses d'un jour, pré-sélectionner étape 1 et masquer le sélecteur

### 2. `src/components/arena/LiveCoursesTab.tsx` — Ajouter filtre étape côté user
- Après sélection de la course, afficher des chips d'étapes disponibles (extraites des messages existants via metadata ou une query distincte)
- Filtrer les messages côté client par `metadata.etape_numero` quand une étape est sélectionnée, ou tous si aucune étape choisie

### 3. `src/components/arena/RaceSituationEditor.tsx` — Aucun changement
- La situation est déjà correctement broadcastée via metadata

### Pas de migration SQL nécessaire
- `etape_numero` passe dans le champ `metadata` (jsonb) existant des `arena_messages`
- Le RPC broadcast copie déjà `p_metadata` tel quel dans toutes les ligues

## Fichiers impactés

| Fichier | Action |
|---|---|
| `src/pages/admin/SuperAdminLiveBroadcastPage.tsx` | Ajouter sélecteur étape + injecter dans metadata + filtrer historique |
| `src/components/arena/LiveCoursesTab.tsx` | Ajouter chips de filtre par étape (extraites des metadata des messages) |

