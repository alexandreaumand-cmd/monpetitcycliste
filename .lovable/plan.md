

## Améliorer l'affichage du détail des bonus coureurs (+25%)

### Problèmes identifiés

1. **Numéro d'étape invisible** : Le commentaire est parsé en `"Volta Comunitat Valenciana - Etape"` sans numéro de stage. Les anciens commentaires n'incluent pas le numéro d'étape. De plus, la colonne "Détail" a `max-w-xs truncate` qui tronque le texte.

2. **Points barème absents** : On ne voit que les points bonus (+25%), pas les points de base du barème dont ils sont issus.

### Solution

**Fichier** : `src/components/rankings/BonusPointsDetailDialog.tsx`

1. **Enrichir les données** : Pour chaque bonus coureur, cross-référencer avec `points_ledger` pour retrouver les points de base (barème). Puisque bonus = base × 0.25, on peut aussi simplement calculer `base = bonus / 0.25` (= bonus × 4). C'est plus simple et évite une requête supplémentaire.

2. **Améliorer le parsing du commentaire** : Extraire le type de classement et le numéro d'étape séparément. Le format actuel est `"... - course_id - Etape"` ou `"... - course_id - Etape Etape N"`. Parser avec regex pour isoler le type et le numéro.

3. **Restructurer les colonnes du tableau** :
   - **Phase** (si multi-phase)
   - **Coureur** (nom)
   - **Équipe** (nom court)
   - **Course** (nom de la course, sans truncate excessif)
   - **Classement** (type : Etape, General, etc.)
   - **Étape** (numéro, affiché séparément — "E3", "GC", etc.)
   - **Barème** (points de base = bonus × 4, en texte muted)
   - **Bonus** (points bonus, en vert)

4. **Supprimer le `max-w-xs truncate`** sur la colonne Détail — remplacé par des colonnes séparées plus lisibles.

5. **Sur mobile** : Les colonnes Équipe et Barème peuvent être masquées (`hidden md:table-cell`) pour éviter le débordement.

### Résultat attendu

Au lieu de :
```
Coureur | Équipe | Détail (tronqué)              | Points
Vlasov  | RB-BH  | Volta Comunitat Valenc... Etap | +15
```

On aura :
```
Coureur | Course                          | Class. | Ét. | Barème | Bonus
Vlasov  | Volta Comunitat Valenciana      | Etape  | 3   | 60     | +15
Vlasov  | Volta Comunitat Valenciana      | General|  —  | 70     | +17.5
```

