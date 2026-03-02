

## Correction du dialogue "Créer un coureur" depuis les données startlist

### Probleme 1 : L'equipe existante n'est pas trouvee

**Cause** : Le code actuel cherche l'equipe uniquement par `trigramme` avec `ilike`. Or, `source_team` contient le nom complet avec un suffixe de categorie entre parentheses (ex: `"XDS Astana Team (WT)"`), tandis que le trigramme en base est `"XAT"` et le `nom_affiche` est `"XDS Astana Team"`. Aucune correspondance n'est jamais trouvee, donc le dialogue "Creer une nouvelle equipe" s'affiche systematiquement.

**Solution** : Ameliorer la recherche d'equipe dans le `useEffect` de `CreateRiderDialog.tsx` :
1. Nettoyer le `source_team` en retirant le suffixe de categorie entre parentheses (ex: `"XDS Astana Team (WT)"` devient `"XDS Astana Team"`)
2. Chercher par correspondance multi-criteres : `nom_affiche` (ilike), `trigramme` (ilike), et `code_court` de la table `equipes` (ilike)
3. Ne proposer la creation d'equipe que si aucune correspondance n'est trouvee

### Probleme 2 : Le nom est en format "NOM Prenom" au lieu de "Prenom NOM"

**Cause** : Le `source_name` provenant du scraping PCS est au format `"GALBUSERA Pietro"`. Le champ `nom` du formulaire est pre-rempli tel quel, alors que la convention de la base est `"Pietro Galbusera"`.

**Solution** : Ajouter une fonction `convertNameFormat` qui :
1. Detecte les mots en majuscules (le nom de famille) et les mots en casse mixte (le prenom)
2. Reorganise en "Prenom Nom" avec la bonne casse (ex: `"GALBUSERA Pietro"` devient `"Pietro Galbusera"`)
3. Pre-remplit le champ `nom` avec le format converti

### Fichier modifie

**`src/components/admin/startlist-data/CreateRiderDialog.tsx`** :

1. Ajouter une fonction utilitaire `convertNameFormat(sourceName)` :
   - Separe les mots du nom
   - Identifie les mots tout en majuscules comme le nom de famille
   - Place le prenom en premier, suivi du nom de famille avec une majuscule initiale
   - Cas particulier : si un seul mot ou tout en majuscules, on met juste la casse correcte

2. Ajouter une fonction `cleanSourceTeam(sourceTeam)` :
   - Retire les suffixes entre parentheses comme `(WT)`, `(CT)`, `(PT)`
   - Trim le resultat

3. Modifier le `useEffect` de recherche d'equipe :
   - Utiliser le nom nettoyé pour chercher par `nom_affiche` via `ilike`
   - Si pas de resultat, chercher par `trigramme`
   - Ne declencher `setShowCreateTeam(true)` que si aucune correspondance n'est trouvee

4. Initialiser `formData.nom` avec `convertNameFormat(entry.source_name)` au lieu de `entry.source_name` directement

