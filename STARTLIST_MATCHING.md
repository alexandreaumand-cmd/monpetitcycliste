# Startlist Matching - Documentation

## Format attendu des startlists

Les startlists peuvent être importées dans les formats suivants :

### Format standard (recommandé)
```
PLACE   TEAM    NAME            TIME
1       UAD     POGACAR Tadej   0:00
2       Q36     PIDCOCK Thomas  0:00
3       VIS     VAN AERT Wout   0:00
```

### Formats acceptés
- **Avec tous les champs** : `PLACE TEAM NAME TIME`
- **Sans temps** : `PLACE TEAM NAME`
- **Team à la fin** : `PLACE NAME TEAM [TIME]`
- **Sans team** : `PLACE NAME [TIME]`
- **Sans place** : `TEAM NAME [TIME]`

### Contraintes
- **PLACE** : Nombre optionnel, peut être suivi d'un point (ex: `1.`)
- **TEAM** : Code d'équipe de 2 à 4 caractères alphanumériques (ex: `UAD`, `Q36`, `INEOS`)
- **NAME** : Nom complet du coureur (lettres, espaces, tirets, apostrophes, accents)
- **TIME** : Optionnel, format `H:MM` ou `MM:SS` (ex: `0:00`, `1:23`)

## Stratégies de matching (par ordre de priorité)

### 1. Alias exact (confiance: 1.0)
Match direct via la table `name_aliases` pour gérer les variations de noms connues.

### 2. Roster - Match exact (confiance: 1.0)
Comparaison exacte du nom normalisé avec un coureur du roster de la phase.

### 3. Roster - Tokens + Last name (confiance: 0.95)
- Signature des tokens identique (`key_sig`)
- Derniers noms similaires (similarité > 0.85)

### 4. Roster - Fuzzy (confiance: 0.90)
Similarité globale > 0.90 sur le nom complet normalisé.

### 5. Fallback sur tous les coureurs (off-roster)
Si aucun match dans le roster, recherche dans tous les coureurs avec `on_roster=false` :
- **Match exact** (confiance: 0.88)
- **Tokens** (confiance: 0.85)
- **Fuzzy > 0.92** (confiance: 0.85)

### 6. Unmatched (confiance: 0.0)
Aucun coureur trouvé, `coureur_id = null`.

## Gestion des cas spéciaux

### Noms avec particules
Les particules (`VAN`, `DE`, `DER`, `VON`, etc.) sont gérées automatiquement :
- **Input** : `VAN AERT Wout`
- **Canonical** : `Wout VAN AERT` (prénom avant particule+nom)
- **Last name** : `VAN AERT` (particule incluse)

### Inversion de noms
La fonction `canonizeName()` tente de réordonner les noms au format "Prénom NOM" :
- **Input** : `POGACAR Tadej` (NOM en majuscules)
- **Output** : `Tadej POGACAR`

### Codes d'équipe courts
Les codes d'équipe de 2-4 caractères sont acceptés (ex: `Q36`, `UAD`, `INEOS`).

## Seuils de confiance

| Niveau | Seuil | Statut |
|--------|-------|--------|
| **Confirmé** | ≥ 0.85 | Prêt pour validation |
| **Non matché** | < 0.85 | Nécessite révision manuelle |

## Normalisation

Toutes les comparaisons utilisent une normalisation Unicode :
- Suppression des accents : `É` → `E`
- Majuscules : `pogacar` → `POGACAR`
- Espaces multiples → espace simple
- Caractères spéciaux mappés (œ → oe, etc.)

## Exemples de matching

```
Input: "1  UAD  POGACAR Tadej  0:00"
→ Parsed: place=1, team=UAD, source_name="POGACAR Tadej"
→ Canonical: "Tadej POGACAR"
→ Match: Tadej POGACAR (coureur_id=123, confiance=1.0, on_roster=true)

Input: "2  Q36  VAN AERT Wout"
→ Parsed: place=2, team=Q36, source_name="VAN AERT Wout"
→ Canonical: "Wout VAN AERT"
→ Match: Wout VAN AERT (coureur_id=456, confiance=1.0, on_roster=true)

Input: "SMITH John"
→ Parsed: place=null, team=null, source_name="SMITH John"
→ Canonical: "John SMITH"
→ Match: John SMITH (coureur_id=789, confiance=0.85, on_roster=false)
```

## Logs de debug

Les logs suivent ce format :
```
[PARSE] Entry 1: line_no=1, team=UAD, source="POGACAR Tadej", canonical="Tadej POGACAR"
[PARSE] Entry 2: line_no=2, team=Q36, source="PIDCOCK Thomas", canonical="Thomas PIDCOCK"
[PARSE] Total parsed: 13 entries
[MATCH] First match: coureur_id=123, strategy="exact", confidence=1, on_roster=true
[SUMMARY] Parsed 13 entries → 13 confirmed, 0 unmatched
```

## Stockage

Les résultats sont stockés dans `startlist_entries` avec :
- `import_id` : ID de l'import (table `startlist_imports`)
- `line_no` : Numéro de ligne d'origine
- `source_*` : Données brutes extraites
- `canonical_guess` : Nom canonisé
- `coureur_id` : ID du coureur matché (null si non matché)
- `confidence` : Score de confiance [0.0 - 1.0]
- `match_strategy` : Stratégie utilisée
- `on_roster` : Coureur dans le roster de la phase
