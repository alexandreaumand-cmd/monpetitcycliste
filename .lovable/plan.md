

# Plan: Modélisation visuelle de la course avec groupes

## Concept
Ajouter un éditeur de "situation de course" dans la page Super Admin Live Broadcast. L'admin configure les groupes (nombre, coureurs, écarts), puis broadcast cette situation comme un message spécial via le même RPC existant. Côté user, le `MessageBubble` détecte la metadata `race_situation` et affiche une visualisation horizontale avec des petits vélos.

## Architecture

La situation de course est stockée dans le champ `metadata` (jsonb) des messages broadcast :
```json
{
  "race_situation": {
    "groups": [
      { "name": "Échappée", "riders": ["Pogačar", "Vingegaard"], "riderCount": 2, "gap": "0:00", "isPeloton": false },
      { "name": "Chasse", "riders": ["Evenepoel"], "riderCount": 3, "gap": "+1:30", "isPeloton": false },
      { "name": "Peloton", "riders": [], "riderCount": 150, "gap": "+4:00", "isPeloton": true }
    ],
    "kmRemaining": 45
  }
}
```

Aucune migration SQL nécessaire — tout passe par le champ `metadata` existant.

## Fichiers impactés

| Fichier | Action |
|---|---|
| `src/components/arena/RaceSituationEditor.tsx` | **Créer** — Formulaire admin : ajouter/supprimer groupes, nommer, indiquer isPeloton, saisir coureurs et écarts, km restants |
| `src/components/arena/RaceSituationDisplay.tsx` | **Créer** — Rendu visuel : barre horizontale représentant la course, petits vélos 🚴 pour chaque groupe, proportionnel aux écarts, tooltip avec détail coureurs |
| `src/pages/admin/SuperAdminLiveBroadcastPage.tsx` | **Modifier** — Ajouter section "Situation de course" avec le RaceSituationEditor + bouton broadcast qui envoie via handleSend avec metadata |
| `src/components/arena/MessageBubble.tsx` | **Modifier** — Détecter `metadata.race_situation` et afficher `RaceSituationDisplay` au lieu du texte brut |

## Détail des composants

### RaceSituationEditor (admin)
- État local : tableau de groupes + km restants
- Boutons +/- pour ajouter/supprimer des groupes
- Pour chaque groupe : champ nom, toggle "Peloton", input nombre de coureurs, textarea noms coureurs (un par ligne ou virgule), input écart (format mm:ss)
- Autocomplete coureurs depuis la startlist (réutilise `startlistRiders`)
- Bouton "Diffuser la situation" qui appelle handleSend avec content auto-généré (ex: "🏁 Situation à 45km") et metadata contenant race_situation

### RaceSituationDisplay (user + admin history)
- Barre horizontale (la "route") avec marqueur arrivée à droite
- Groupes positionnés de droite (tête) à gauche (queue) proportionnellement aux écarts
- Icône vélo (emoji ou SVG) par groupe, taille proportionnelle au nombre de coureurs
- Label du groupe + écart au-dessus
- Badge "Peloton" distinctif (couleur différente, plus gros)
- Noms des coureurs affichés en dessous du groupe (ou en tooltip si trop nombreux)
- Km restants affiché sur la barre
- Responsive : fonctionne en mobile (scroll horizontal si nécessaire)

