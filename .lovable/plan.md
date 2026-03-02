

## Correction automatique du date_classement dans la saisie des resultats

### Probleme identifie

La fonction SQL `admin_result_save_lot` utilise `COALESCE(date_classement, CURRENT_DATE)` comme date par defaut lorsqu'aucune date n'est passee dans les lignes de resultats. Or, **ni le desktop ni le mobile** ne transmettent le `date_classement` dans les rows envoyees a l'edge function (sauf pour les TTT en mode direct insert sur desktop).

Consequence : la date enregistree est la date de saisie (ex: 17/02) au lieu de la date reelle de la course (ex: 13/02). Cela decale les points dans le heatmap hebdomadaire.

**Cas concret** : Vuelta Region Murcia etape 1, date reelle 2026-02-13 (S7), enregistree avec 2026-02-17 (S8).

### Solution

Modifier la fonction SQL `admin_result_save_lot` pour calculer automatiquement le `date_classement` a partir des donnees de la course, sans dependre du client.

### Modifications

#### 1. Migration SQL : mise a jour de `admin_result_save_lot`

Remplacer la ligne :
```text
COALESCE((row_data->>'date_classement')::date, CURRENT_DATE)
```

Par un calcul automatique :
```text
CASE
  WHEN p_etape_numero IS NOT NULL THEN
    -- Pour les etapes : date_debut + (etape_numero - 1) jours
    (v_date_debut + (p_etape_numero - 1) * interval '1 day')::date
  ELSE
    -- Pour les classements generaux et one-day : date_fin de la course
    v_date_fin
END
```

Ajouter les variables `v_date_debut` et `v_date_fin` au debut de la fonction, extraites de la table `courses` (deja requetee pour `saison_id`).

#### 2. Correction des donnees existantes en production

Executer une migration pour corriger la Vuelta Region Murcia :
```text
UPDATE race_results
SET date_classement = '2026-02-13'
WHERE course_id = 'vuelta_a_la_regi_n_de_murcia_costa_c_lida'
  AND etape_numero = 1
  AND date_classement = '2026-02-17';
```

### Details techniques

- La variable `v_date_debut` / `v_date_fin` sera extraite dans le meme `SELECT` qui recupere deja `v_saison_id` depuis `courses JOIN phases`
- Le calcul `date_debut + (etape_numero - 1)` est une approximation raisonnable pour les courses par etapes (chaque etape = 1 jour). Si des jours de repos existent, l'admin peut toujours passer un `date_classement` explicite dans les rows (le `COALESCE` existant sera conserve en priorite)
- L'ordre de priorite sera : `date_classement` explicite dans les rows > calcul automatique
- Aucune modification du code frontend n'est necessaire

### Impact

- Toutes les futures saisies auront automatiquement la bonne date, que ce soit depuis le mobile ou le desktop
- Le heatmap hebdomadaire affichera les points dans la bonne semaine
- Les saisies TTT via insertion directe sur desktop continueront de fonctionner comme avant (elles passent deja un `dateClassement`)

