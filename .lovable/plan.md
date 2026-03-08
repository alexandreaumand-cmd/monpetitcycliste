

# Plan: Corriger les vélos, afficher coureurs+managers, masquer le super admin

## 3 changements

### 1. Retourner les vélos (face à droite → vers l'arrivée)
**Fichier**: `src/components/arena/RaceSituationDisplay.tsx`
- Appliquer `style={{ transform: 'scaleX(-1)' }}` sur les emoji 🚴 pour qu'ils soient orientés vers la droite (vers le drapeau d'arrivée)

### 2. Afficher les noms des coureurs + leur manager dans le display
**Fichier**: `src/components/arena/RaceSituationDisplay.tsx`
- Ajouter une prop `rosterOwners?: Record<string, string>` (coureur_id → manager name)
- Ajouter une prop `riderMentions?: { rider_nom: string; coureur_id: string }[]` (pour mapper nom → coureur_id)
- Sous chaque groupe (sous le nombre de coureurs), afficher la liste des riders avec leur manager entre parenthèses : `Pogačar (Ludo)`
- Si trop de noms, afficher les premiers + "+N autres" en tooltip

**Fichier**: `src/components/arena/RaceSituationEditor.tsx`
- Quand le super admin saisit des noms de coureurs, stocker aussi les `coureur_id` correspondants dans la metadata (matcher contre `startlistRiders`)
- Enrichir l'interface `RaceGroup` avec un champ optionnel `riderIds: string[]`

**Fichier**: `src/pages/admin/SuperAdminLiveBroadcastPage.tsx`
- Passer les `startlistRiders` au `RaceSituationEditor` (déjà fait)
- Enrichir la metadata broadcast avec un tableau `rider_mentions` extrait des groupes (nom + coureur_id)

**Fichier**: `src/components/arena/MessageBubble.tsx`
- Passer `rosterOwners` et les `rider_mentions` de la metadata au `RaceSituationDisplay`

**Fichier**: `src/components/arena/LiveCoursesTab.tsx`
- `rosterOwners` est déjà chargé et passé au `MessageBubble` — pas de changement

### 3. Masquer le nom du super admin sur les messages broadcast
**Fichier**: `src/components/arena/MessageBubble.tsx`
- Pour les messages `admin_broadcast`, ne pas afficher l'auteur (nom + avatar). Afficher à la place un indicateur générique type "📡 Live" ou juste le shield icon sans nom
- Supprimer `isOwnMessage` pour les broadcasts (toujours affiché côté gauche)

## Résumé fichiers

| Fichier | Action |
|---|---|
| `RaceSituationDisplay.tsx` | Flip vélos + afficher riders avec managers |
| `RaceSituationEditor.tsx` | Stocker riderIds dans les groupes |
| `SuperAdminLiveBroadcastPage.tsx` | Enrichir metadata avec rider_mentions depuis les groupes |
| `MessageBubble.tsx` | Passer props au display + masquer auteur sur broadcast |

