## Objectif
Corriger la fonction de lecture des abandons pour que tous les DNF/DNS du Giro soient détectés, y compris Santiago Buitrago et Arnaud De Lie.

## Diagnostic
La source PCS contient bien 15 abandons sur le Giro, mais seulement 11 sont enregistrés en base.
Les 4 manquants suivent le même motif : ce sont les premiers abandons de certains blocs équipe.

Cause racine : le parseur actuel utilise une regex globale sur `<li>...</li>`, alors que le HTML PCS imbrique des listes d’équipes et des listes de coureurs. Sur le premier coureur abandonné d’un bloc, le texte récupéré contient aussi le nom de l’équipe (`Bahrain - Victorious`, `Lotto Intermarché`, etc.), ce qui casse l’extraction du nom du coureur et empêche le matching.

## Plan
1. Refaire le parsing HTML des abandons pour cibler uniquement les `<li class="dropout">` des coureurs, au lieu de parser tous les `<li>`.
2. Extraire le dossard et le nom depuis les balises internes (`<span class="bib">`, lien coureur) afin d’éviter que le nom d’équipe pollue la chaîne analysée.
3. Conserver le matching existant par dossard puis par nom normalisé, mais l’appliquer sur les données corrigées du parseur.
4. Tester la fonction sur le Giro pour vérifier qu’on remonte bien les 15 abandons PCS et que les 4 manquants sont désormais enregistrés.
5. Vérifier qu’aucune régression n’apparaît sur l’autre course en cours concernée (Tour de Hongrie).

## Détails techniques
- Fichier principal : `supabase/functions/scrape-startlist-abandons/index.ts`
- Le correctif restera limité à la fonction de scraping, sans changement UI.
- Validation attendue :
  - PCS Giro : 15 abandons détectés
  - Base Giro : Buitrago, De Lie, Groves et Adam Yates présents avec leur bon statut/étape
  - Tour de Hongrie toujours fonctionnel