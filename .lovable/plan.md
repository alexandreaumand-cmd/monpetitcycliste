

## Améliorer le rendu "Situation de course" dans la page Live Broadcast admin

### Constat

La page admin affiche la situation de course de deux manières :
1. **RaceSituationEditor** (colonne droite) — formulaire d'édition brut sans aperçu visuel du résultat
2. **Historique** (colonne gauche) — utilise déjà `RaceSituationDisplay` mais il est imbriqué dans un petit bloc de message, peu lisible

### Changements proposés

#### 1. Ajouter un aperçu live dans le RaceSituationEditor

Sous les groupes éditables et au-dessus du bouton "Diffuser", afficher un **aperçu en temps réel** utilisant `RaceSituationDisplay` avec les données du formulaire. Cela permet à l'admin de voir exactement ce que les utilisateurs verront avant de diffuser.

```text
┌─ Situation de course ─────────────────┐
│ Km restants: [___]                    │
│                                       │
│ ┌─ Groupe 1 ────────────────────────┐ │
│ │ Nom / Nb coureurs / Écart / ...   │ │
│ └───────────────────────────────────┘ │
│ ┌─ Peloton ─────────────────────────┐ │
│ │ ...                               │ │
│ └───────────────────────────────────┘ │
│                                       │
│ ── Aperçu ──────────────────────────  │
│ 🏁 120 km restants                    │
│ ① THE BREAKAWAY        +0:00         │
│ │ 1  14  SOLER Marc (Manager1)       │
│ │ 2  32  HIRSCHI Marc (-)            │
│ ② CHASE GROUP          +1:45         │
│ │ ...                                │
│ Ⓟ PELOTON              +3:20         │
│   142 coureurs                        │
│                                       │
│ [+ Groupe]    [📡 Diffuser]          │
└───────────────────────────────────────┘
```

#### 2. Améliorer le rendu dans l'historique

Donner plus d'espace au `RaceSituationDisplay` dans les messages de l'historique : retirer le padding excessif et laisser le composant occuper toute la largeur du bloc message.

### Fichiers impactés
- `src/components/arena/RaceSituationEditor.tsx` — importer `RaceSituationDisplay` et ajouter la section aperçu
- `src/pages/admin/SuperAdminLiveBroadcastPage.tsx` — ajustements mineurs de style sur le rendu historique

