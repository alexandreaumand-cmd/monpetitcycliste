

## Fix : le scraper PCS confond les dossards avec le nombre de coureurs

### Problème

Dans `parsePCSLive` (ligne 144), le parser extrait le **premier nombre** du texte de chaque groupe et l'interprète comme le nombre de coureurs (`riderCount`). En réalité, ce nombre est le **dossard du premier coureur** (14, 32, 75, 111 dans l'exemple). Le vrai nombre de coureurs est simplement `groupRiders.length`.

Conséquence : le groupe "The Breakaway" (4 coureurs) affiche `riderCount = 14` (le dossard de Soler), ce qui fausse la détection peloton (`riderCount > 50`) et l'affichage.

### Solution

Dans `supabase/functions/scrape-live-race/index.ts`, fonction `parsePCSLive` :

1. **Supprimer la détection erronée** du rider count par regex (ligne 144-145)
2. **Utiliser `groupRiders.length`** comme seul `riderCount` fiable
3. **Ajuster la détection peloton** : se baser sur le nom du groupe (`peloton` dans le texte) plutôt que sur un seuil numérique arbitraire, car le count n'est plus fiable depuis le HTML

### Fichier impacté
- `supabase/functions/scrape-live-race/index.ts` — lignes 143-145, 179, 181-188

