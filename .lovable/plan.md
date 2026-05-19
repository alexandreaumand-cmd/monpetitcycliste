## Diagnostic
Le problème ne vient pas du backend ni du déclenchement manuel : la fonction `scrape-rider-injuries` s’exécute bien.

## Cause exacte
Le parseur des blessures cherche uniquement des liens au format :
```text
href="/rider/..."
```
Or la page PCS des blessures renvoie actuellement des liens au format :
```text
href="rider/..."
```
Sans slash initial.

Résultat :
- le HTML est bien récupéré
- les noms attendus sont bien présents (`CHRISTEN Fabio`, `LAPORTE Christophe`, `VANHOUCKE Harm`)
- mais la regex ne matche aucun bloc
- donc `parseInjuries()` retourne `0`
- et l’écran affiche `0 blessures trouvées`

## Ce que j’ai vérifié
- La page PCS renvoie bien du contenu exploitable
- Les deux User-Agent testés renvoient le même HTML utile
- Le backend est sain
- La regex actuelle retourne `0` match
- Une version avec slash optionnel retourne `67` matches, dont les 3 coureurs cités

## Correctif proposé
1. Modifier la regex de `scrape-rider-injuries` pour accepter :
   - `href="rider/..."`
   - `href="/rider/..."`
2. Aligner les headers HTTP sur ceux déjà utilisés par le scraper startlist pour éviter les écarts futurs
3. Ajouter un peu de log backend (`html length`, `match count`, premiers noms`) pour diagnostiquer rapidement si PCS change encore sa structure
4. Redéployer puis tester depuis Super Admin > Blessés

## Impact
- Aucun changement de base de données
- Aucun changement UI
- Aucun changement cron
- Correction limitée à la fonction `scrape-rider-injuries`

## Détail technique
La regex actuelle de découpe des blocs est trop stricte sur le début du `href`. Le bug est donc dans le parsing HTML, pas dans le matching des noms ni dans l’upsert en base.