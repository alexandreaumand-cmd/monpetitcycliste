

# Corriger l'image d'export des resultats

## Probleme identifie

L'image generee dans ta capture d'ecran ne correspond pas au template defini dans le code actuel (`ExportResultsImage.tsx`). Cela peut etre du a :

1. **Cache navigateur** - Rafraichir la page avec Ctrl+Shift+R
2. **Template non rendu correctement** - Le code est correct mais l'image montre l'ancien design

En analysant les donnees reseau, je confirme que l'edge function `results-course-table` retourne bien les managers :
- Jonathan MILAN → Bubu
- Pascal ACKERMANN → Fab
- Daniel SKERL → Fab
- etc.

Mais l'image montre "-" pour tous.

---

## Solution

### 1. Verifier que le template est bien rendu

Le template actuel (lignes 418-586) devrait afficher :
- Header jaune avec 🏆, nom de course, categorie, date
- Tableau blanc avec 5 colonnes : Pos, Coureur, Equipe, Manager, Points
- Section maillots si course par etapes
- Footer avec nom de la ligue

Mais l'image montre un design completement different (pas de header, 3 colonnes seulement).

### 2. Forcer le re-rendu

Le probleme pourrait etre que le `generatedImageUrl` est mis en cache. Je vais ajouter une logique pour **reset l'image generee** quand le dialog s'ouvre.

### Fichier : `src/components/admin/ExportResultsImage.tsx`

**Modification 1 : Reset l'image quand le dialog s'ouvre**

Ajouter un `useEffect` pour reinitialiser `generatedImageUrl` a `null` quand `open` passe a `true` :

```typescript
// Apres la ligne 45
useEffect(() => {
  if (open) {
    setGeneratedImageUrl(null);
  }
}, [open]);
```

**Modification 2 : Ajouter des logs pour debug**

Ajouter un console.log temporaire pour verifier que les donnees sont correctement recues :

```typescript
// Dans la query topRiders, apres le .map()
console.log("Export riders data:", data?.rows?.slice(0, 3));
```

### 3. Verification des donnees

D'apres les logs reseau, la reponse de `results-course-table` contient bien `manager_nom`. Exemple :
```json
{
  "coureur_nom": "Jonathan MILAN",
  "manager_nom": "Bubu",
  "points_officiels": 150
}
```

Le template utilise `rider.manager_nom || "-"` ce qui devrait afficher "Bubu" et non "-".

---

## Actions a effectuer

| Fichier | Modification |
|---------|--------------|
| `ExportResultsImage.tsx` | Ajouter `useEffect` pour reset `generatedImageUrl` a l'ouverture |
| | Verifier que les donnees sont bien chargees avant generation |
| | S'assurer que le template TdF est rendu (header jaune, 5 colonnes, footer ligue) |

---

## Resultat attendu

Apres ces corrections :
1. Ouvrir le dialog "Partager les resultats"
2. Cliquer "Generer l'apercu"
3. L'image devrait afficher :
   - Header : 🏆 AlUla Tour - 2.pro - Etape Etape 2 - 31 janvier 2026
   - Tableau : Position (🥇🥈🥉), Coureur, Equipe, Manager (Bubu, Fab, etc.), Points
   - Footer : MPC 2026 (ou le nom de ta ligue)

