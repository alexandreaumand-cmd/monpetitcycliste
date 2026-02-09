

# Refonte du Startlist Tracker : approche directe avec matching existant

## Probleme constate

Le tracker detecte de **faux retraits** pour l'UAE Tour (et potentiellement d'autres courses). Exemples concrets en LIVE :
- `MUHLBERGER Gregor` detecte comme "removed" alors que `MUHLBERGER Gregor` est toujours sur PCS (accent `u` mal gere)
- `Adam YATES` detecte comme "removed" car le nom en base est stocke dans un ordre different (`YATES Adam` sur PCS)
- `PALENI Enzo`, `MEZGEC Luka`, `MILAN Matteo`, etc. : memes causes

**Cause racine** : Le tracker utilise une normalisation simpliste (ligne 588-593) qui supprime les caracteres speciaux et ne gere ni les accents (`o` pour `ø`, `u` pour `u`) ni l'ordre des mots. En parallele, il n'utilise pas la table `name_aliases` ni le matching multi-strategie deja presents dans `startlist-import`.

## Approche proposee

Reprendre la methodologie suggeree : **lire PCS, comparer avec la startlist existante**, et agir directement :

```text
Pour chaque course :
  1. Scraper PCS --> liste de coureurs scraped[]
  2. Charger startlist_entries existantes --> liste existing[]
  3. Comparer avec tokenSig (normalisation robuste + tri alphabetique) :
     - Coureur present dans les deux --> ne rien faire
     - Coureur sur PCS mais absent en base --> AJOUTER (avec matching complet)
     - Coureur en base mais absent de PCS --> RETIRER
  4. Logger les changements dans startlist_tracker_changes (audit)
```

## Details techniques

### 1. Remplacer la normalisation du tracker

Remplacer la fonction `normalizeName` (lignes 360-368) et le `normalize` inline (lignes 588-593) par la version robuste deja utilisee dans `startlist-import` :
- `CHAR_MAP` complet (o pour ø, u pour u, ss pour ß, etc.)
- `tokenSig()` : normalisation + tri alphabetique des mots

Cela garantit que `"YATES Adam"` et `"Adam YATES"` produisent la meme cle (`"ADAM YATES"`), et que `"MUHLBERGER"` et `"MUHLBERGER"` sont identiques.

### 2. Refondre `generateFullSyncChanges` en approche directe

La fonction actuelle (lignes 511-660) sera simplifiee :

- Charger les `startlist_entries` existantes avec leur `coureur_id` et `coureurs.nom`
- Construire un `Set` de cles tokenSig pour les coureurs scraped
- Construire un `Map<tokenSig, entryId>` pour les entries existantes (en utilisant a la fois `source_name` et `coureurs.nom`)
- **Additions** : pour chaque coureur scraped dont la cle n'est pas dans la map existante, marquer comme ajout
- **Retraits** : pour chaque entry existante dont la cle n'est ni dans les scraped NI deja couverte par un autre entry avec la meme cle, marquer comme retrait

### 3. Utiliser le matching complet pour les ajouts

Pour chaque coureur a ajouter, reutiliser la meme logique que `startlist-import` :
1. Consulter `name_aliases` (priorite maximale)
2. Match exact normalise sur le roster
3. Match par `tokenSig` (roster puis off-roster)
4. Match fuzzy Levenshtein (roster puis off-roster)

Les donnees necessaires (roster riders, all riders, aliases) seront chargees une seule fois par course.

### 4. Agir directement sur `startlist_entries`

Au lieu du flux actuel en 2 etapes (generer des changes puis les traiter dans `processChanges`), agir directement :
- **Ajout** : inserer dans `startlist_entries` avec le `coureur_id` trouve
- **Retrait** : supprimer de `startlist_entries` (avec cascade manuelle sur `startlist_tracker_changes` comme dans la suppression manuelle existante)
- **Logger** : inserer dans `startlist_tracker_changes` pour l'audit avec un statut `validated` immediat

### 5. Simplifier `processChanges`

Cette fonction (lignes 662-900) sera fortement reduite ou supprimee car le traitement se fera directement dans la boucle de comparaison. Plus besoin de re-rechercher la course, re-matcher le coureur, etc.

### 6. Nettoyage des faux changements en LIVE

Apres deploiement, les ~20 faux changements "pending" pour UAE Tour pourront etre marques comme `skipped` via une requete SQL :

```sql
UPDATE startlist_tracker_changes
SET validation_status = 'skipped', processed = true
WHERE course_name = 'UAE Tour'
AND validation_status = 'pending';
```

## Fichiers modifies

- `supabase/functions/startlist-tracker/index.ts` : refonte de la normalisation, du flux de comparaison et de la logique de traitement

## Benefices

- **Pas de faux positifs** : meme normalisation robuste que l'import manuel
- **Aliases supportes** : les coureurs avec des noms ambigus sont reconnus
- **Code simplifie** : une seule passe au lieu de deux etapes distinctes
- **Moins de requetes DB** : les donnees de matching sont chargees une fois par course, pas une fois par coureur

