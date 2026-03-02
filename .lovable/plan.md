
## Correction du calcul de points en saisie mobile

### Probleme identifie

La saisie mobile utilise un chemin de sauvegarde different du desktop, causant des points incorrects :

- **Desktop** : appelle l'edge function `admin-result-save-lot` (qui utilise la RPC SQL `admin_result_save_lot`), puis `admin_compute_points_for_course` pour calculer correctement les points via `scoring_rules_saisons` (filtree par saison).
- **Mobile** : interroge la vue `scoring_rules_norm` (qui contient **toutes les saisons** sans filtre), construit un `scoringMap` ambigu, puis insere directement dans `race_results` avec des points potentiellement faux. La derniere valeur trouvee pour une meme place gagne (aleatoire : 5 au lieu de 200).

### Solution

Aligner le mobile sur le desktop en utilisant le meme edge function `admin-result-save-lot` et le meme flux de recalcul des points.

### Modifications

**Fichier** : `src/components/admin/ResultsEntryStudio.mobile.tsx`

1. **Remplacer la sauvegarde directe des resultats (lignes ~438-530)** :
   - Supprimer le code qui interroge `scoring_rules_norm` et construit un `scoringMap`
   - Supprimer le code qui fait `delete` puis `insert` directement dans `race_results`
   - Remplacer par un appel a `supabase.functions.invoke('admin-result-save-lot', ...)` avec les memes parametres que le desktop :
     ```text
     body: {
       p_course_id: course.course_id,
       p_type_classement: currentClassement,
       p_etape_numero: etapeNumeroValue,
       p_rows: validRows.map(row => ({
         coureur_id: row.coureur_id,
         position: row.position,
         statut: row.statut,
       })),
     }
     ```

2. **Sauvegarder les maillots via le meme edge function** (lignes ~532-600) :
   - Remplacer le delete + insert direct par des appels a `admin-result-save-lot` pour chaque porteur de maillot, comme le desktop

3. **Ajouter le recalcul des points** apres la sauvegarde :
   - Appeler `supabase.functions.invoke('compute-points', { body: { course_id: course.course_id } })` apres sauvegarde (identique au desktop)

4. **Supprimer les imports et references a `scoring_rules_norm`** qui ne sont plus necessaires dans la mutation de sauvegarde

### Impact

- Les points seront correctement calcules via `scoring_rules_saisons` filtree par saison
- Le `points_ledger` sera mis a jour via `admin_compute_points_for_course`
- Le comportement sera strictement identique entre mobile et desktop
- Les notifications push existantes seront aussi declenchees sur mobile (gerees par l'edge function)
