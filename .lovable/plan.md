

# Correction des bonus Costiou + Outil d'edition/recalcul Super Admin

## Partie 1 : Correction manuelle des donnees Live

Les bonus d'Ewen Costiou dans la phase `73e540d2` (Etoile de Besseges) sont incorrects car le trigger s'est declenche sur les valeurs initiales (5 pts) avant la mise a jour vers les valeurs de jeu (200 pts).

**Etat actuel en Live :**
| Bonus | Points actuels | Points attendus |
|-------|---------------|-----------------|
| Etape 1 (10 pts) | 2.50 | 2.50 (correct) |
| Porteur Leader (5 pts) | 1.25 | 1.25 (correct) |
| General (200 pts) | **1.25** | **50.00** |
| Etape 5 (100 pts) | **manquant** | **25.00** |
| Porteur Leader etape 5 (5 pts) | **manquant** | **1.25** |

**Requetes SQL a executer manuellement dans Cloud View > Run SQL (Live) :**

```sql
-- 1. Corriger le bonus General (1.25 -> 50.00)
UPDATE bonus_points 
SET points = 50.00, 
    commentaire = 'Bonus coureur automatique (25%) - etoile_de_bess_ges_tour_du_gard - General [corrige manuellement]',
    updated_at = now()
WHERE id = '4ee6745f-4659-4a51-be6d-604f4634a55e';

-- 2. Inserer le bonus manquant Etape 5 (25.00)
INSERT INTO bonus_points (phase_id, coureur_id, manager_id, league_id, bonus_type, points, commentaire, created_by)
VALUES (
  '73e540d2-d008-4d13-ac93-72aec3d5d986', 'ewen_costiou',
  'fc1f58a4-ec7f-49c3-ab7a-62f9b2ada9ea', 'b5b46b5e-7c78-4ad9-a669-b08e8f099800',
  'coureur_bonuse', 25.00,
  'Bonus coureur automatique (25%) - etoile_de_bess_ges_tour_du_gard - Etape 5 [ajoute manuellement]',
  'fc1f58a4-ec7f-49c3-ab7a-62f9b2ada9ea'
);

-- 3. Inserer le bonus manquant Porteur Leader etape 5 (1.25)
INSERT INTO bonus_points (phase_id, coureur_id, manager_id, league_id, bonus_type, points, commentaire, created_by)
VALUES (
  '73e540d2-d008-4d13-ac93-72aec3d5d986', 'ewen_costiou',
  'fc1f58a4-ec7f-49c3-ab7a-62f9b2ada9ea', 'b5b46b5e-7c78-4ad9-a669-b08e8f099800',
  'coureur_bonuse', 1.25,
  'Bonus coureur automatique (25%) - etoile_de_bess_ges_tour_du_gard - Porteur Leader etape 5 [ajoute manuellement]',
  'fc1f58a4-ec7f-49c3-ab7a-62f9b2ada9ea'
);
```

Total bonus Costiou apres correction : **80.25 pts** (au lieu de 5.00 actuels).

---

## Partie 2 : Bouton "Modifier" sur les bonus coureur existants

Ajout d'un bouton d'edition (icone crayon) a cote du bouton de suppression dans le tableau `RiderBonusTab`.

**Fichier modifie : `src/components/admin/bonus/RiderBonusTab.tsx`**

Modifications :
- Ajout de deux states : `editDialogOpen` et `bonusToEdit`
- Ajout d'un `Dialog` d'edition avec formulaire pre-rempli (points + commentaire)
- La fonction `handleEdit` fait un `UPDATE` direct sur `bonus_points` via le client Supabase (les RLS permettent deja les updates pour les admins)
- Un bouton icone "Pencil" (de lucide-react) est ajoute dans la colonne Action de chaque ligne, a cote du bouton "Trash"
- Import de `Pencil` depuis lucide-react
- Le formulaire d'edition contient : champ Points (number, pre-rempli), champ Commentaire (textarea, pre-rempli), boutons Annuler/Sauvegarder

---

## Partie 3 : Edge Function `recalculate-rider-bonuses`

Nouvelle Edge Function permettant de recalculer tous les bonus `coureur_bonuse` pour un coureur specifique dans une phase, ou pour tous les coureurs d'une phase.

**Fichier cree : `supabase/functions/recalculate-rider-bonuses/index.ts`**

Logique de la fonction :
1. Verification superadmin via `is_superadmin()`
2. Recoit `phase_id` (obligatoire) et optionnellement `coureur_id` (pour recalculer un seul coureur)
3. Recupere les `bonus_rider_selections` pour la phase (filtre par coureur si specifie)
4. Pour chaque selection :
   - Recupere tous les points du `points_ledger` pour ce coureur/phase
   - Calcule 25% pour chaque entree (`ROUND(points * 0.25, 2)`)
   - Supprime les anciens bonus `coureur_bonuse` pour ce coureur/manager/league/phase
   - Insere les nouveaux bonus avec les montants corrects et un commentaire incluant le course_id et type_classement
5. Retourne un recapitulatif : nombre de bonus recalcules, total avant/apres
6. Insere un audit log

La fonction utilise le `SUPABASE_SERVICE_ROLE_KEY` pour bypasser les RLS (comme `compute-bonus-scoreurs`), avec verification d'authentification superadmin via un client separe.

---

## Partie 4 : Bouton "Recalculer" dans l'interface

**Fichier modifie : `src/components/admin/bonus/RiderBonusTab.tsx`**

Ajout d'une carte en haut du composant (similaire au pattern du `ManagerBonusTab` avec le bouton "Calculer le bonus Scoreurs") :
- Titre : "Recalcul des bonus coureur (+25%)"
- Description explicative
- Bouton "Recalculer tous les bonus coureur" qui appelle l'Edge Function `recalculate-rider-bonuses` avec le `phase_id`
- Confirmation via `AlertDialog` avant execution (action destructive car supprime et re-cree les bonus)
- Affichage du resultat (toast avec nombre de bonus recalcules et variation du total)

---

## Details techniques

### Cause racine du bug Costiou
Le trigger `trigger_calculate_bonus_rider` se declenche uniquement sur `INSERT` dans `points_ledger`. Lors de l'import via `admin-result-save-lot`, les points sont d'abord inseres avec la valeur brute PCS (5 pts pour un CG de course 2.1), puis mis a jour par la fonction `results_course_table` avec la valeur de jeu (200 pts via `ON CONFLICT DO UPDATE`). Le trigger calcule le bonus sur la valeur initiale et ne se re-declenche pas sur l'UPDATE.

### Fichiers impactes
1. `src/components/admin/bonus/RiderBonusTab.tsx` -- Ajout du bouton Modifier + bouton Recalculer
2. `supabase/functions/recalculate-rider-bonuses/index.ts` -- Nouvelle Edge Function

### Securite
- L'Edge Function verifie le role superadmin via `is_superadmin()`
- Les RLS existantes sur `bonus_points` autorisent les admins a UPDATE et DELETE
- Un audit log est cree pour chaque recalcul
- Pas de SQL brut : toutes les operations passent par le client Supabase type

