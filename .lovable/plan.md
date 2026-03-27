

## Optimiser la densité du tableau résultats mobile — en gardant les équipes

### Objectif
Afficher 15 coureurs visibles sans scroll vertical sur un écran 393×587px, tout en conservant le nom d'équipe sous chaque coureur.

### Calcul d'espace
- Drawer max 90vh ≈ 528px
- Header + tabs + marges ≈ 148px
- Espace disponible pour les rows ≈ 380px
- 15 rows → **~25px par row** (actuellement ~40px)

### Modifications — `src/components/courses/CourseResultsDrawer.tsx`

1. **Masquer le TableHeader** sur mobile — les colonnes (#, Coureur, Pts, Manager) sont évidentes
2. **Réduire la taille de police** : `text-[11px]` → `text-[10px]`
3. **Réduire le padding** des cells : `py-1` → `py-0`
4. **Compresser nom + équipe sur une seule ligne** au lieu de deux lignes (flex-col → flex-row avec séparateur) :
   - Nom en `font-semibold text-[10px]`, équipe en `text-[8px] text-muted-foreground` après un tiret
   - `leading-none` pour minimiser le line-height
5. **Réduire les emojis médailles** : remplacer par un simple numéro en gras coloré (or/argent/bronze) pour gagner ~4px de hauteur
6. **Compresser le header du drawer** : réduire les marges du titre course

### Fichier impacté
- `src/components/courses/CourseResultsDrawer.tsx` — lignes 618-686 (table résultats classique)

