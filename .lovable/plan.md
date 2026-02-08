

# Matching 100% des coureurs : utiliser le slug PCS comme cle directe

## Le probleme actuel

Le systeme actuel charge les 3034 coureurs en memoire et compare les noms normalises. Deux problemes :

1. **Limite de 1000 lignes** : la requete Supabase ne retourne que 1000 coureurs sur 3034, donc 2/3 des coureurs ne sont jamais trouves
2. **Comparaison inutilement complexe** : on compare des noms alors qu'on a deja la cle exacte

## La solution : correspondance directe par ID

Les IDs des coureurs dans ta base suivent exactement le meme format que les slugs PCS :

| Slug PCS (dans le HTML) | ID coureur (dans ta base) |
|--------------------------|---------------------------|
| `mauro-schmid` | `mauro_schmid` |
| `luke-plapp` | `luke_plapp` |
| `mikkel-honore` | `mikkel_honore` |
| `roger-adria` | `roger_adria` |

La transformation est triviale : remplacer les `-` par des `_`.

J'ai teste sur 10 coureurs non-matches : **10/10 trouves** avec cette methode.

## Ce qui va changer

### Edge Function `scrape-pcs-results`

La strategie de matching sera reecrite :

1. **Strategie 1 (nouvelle) : ID direct depuis le slug PCS**
   - Convertir le slug PCS en ID coureur : `mauro-schmid` devient `mauro_schmid`
   - Verifier l'existence dans la base avec une seule requete SQL (`WHERE id IN (...)`)
   - Devrait matcher ~95-100% des coureurs

2. **Strategie 2 (fallback) : Recherche par nom normalise**
   - Pour les rares cas ou le slug PCS ne correspond pas a l'ID en base
   - Utiliser la recherche par token signature existante
   - Charger les coureurs en paginant (plusieurs requetes de 1000) pour couvrir les 3034 coureurs

### Avantages

- **Performance** : une seule requete SQL au lieu de charger 3000+ coureurs en memoire
- **Fiabilite** : correspondance par cle primaire, pas par comparaison de texte
- **Taux de match** : proche de 100% pour tous les coureurs presents dans ta base

## Details techniques

Le changement se fait uniquement dans `supabase/functions/scrape-pcs-results/index.ts` :

- Extraire tous les slugs PCS des resultats scrapes
- Les convertir en IDs potentiels (`slug.replace(/-/g, '_')`)
- Faire une requete `SELECT id, nom FROM coureurs WHERE id IN ($1, $2, ...)` pour verifier lesquels existent
- Associer directement les resultats aux coureurs trouves
- Pour les non-trouves, appliquer le fallback par nom (avec pagination correcte pour depasser la limite de 1000 lignes)

Aucun changement cote frontend, aucune migration SQL necessaire.

