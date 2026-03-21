

## Correction des bonus coureur 25% manquants (Vlasov + potentiellement d'autres)

### Diagnostic

Le trigger `trigger_calculate_bonus_rider` a été corrigé le 20 mars pour inclure le numéro d'étape dans le commentaire de déduplication (ex: "Etape 3", "Etape 6"). Avant cette date, tous les bonus d'étape avaient le même commentaire "...Etape", ce qui causait une collision de déduplication quand un coureur marquait des points sur **plusieurs étapes** de la même course.

**Vlasov** : 30 pts sur l'étape 6 de Paris-Nice → bonus de 7.50 manquant. Seul le bonus de l'étape 3 (3.57) a été créé.

**Autres coureurs potentiellement touchés** : des entrées "rétroactif" plus anciennes ont aussi le même problème, mais les données montrent que seul Vlasov a actuellement 2 étapes avec points sur Paris-Nice sans bonus séparés.

### Solution

**Lancer un recalcul global des bonus coureurs** via l'edge function `recalculate-rider-bonuses` existante. Cette fonction :
1. Supprime tous les `bonus_points` de type `coureur_bonuse` pour chaque coureur/manager/league/phase
2. Recrée les bonus à partir des entrées `points_ledger`, **avec le numéro d'étape** dans le commentaire (le code est déjà correct, ligne 164-172)

### Étapes

1. **Appeler `recalculate-rider-bonuses`** depuis le frontend ou via curl pour la phase en cours — cela corrigera Vlasov et tous les cas similaires
2. **Vérifier** que le bonus de 7.50 pour l'étape 6 de Paris-Nice apparaît dans les données de Vlasov

### Détail technique

Aucun changement de code nécessaire — le trigger et la fonction de recalcul sont déjà corrigés. Il suffit de déclencher le recalcul pour regénérer les données avec la bonne logique de déduplication.

