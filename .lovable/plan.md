

## Fix du scraper L'Équipe — parsing complet de la situation de course

### Problème
Le parser `parseLEquipeLive` produit un résultat erroné (screenshot 2) : un seul groupe "peloton" avec 45 entrées mélangeant des vrais coureurs, du texte de commentaire ("Il s'agissait de Bjorn Koerdt", "Tom Boonen l'a remporté cinq fois...") et des noms de lieux ("Berg Ten Houte", "Oude Kruisberg"). La situation attendue (screenshot 1) contient 4 groupes distincts avec des écarts structurés.

**Causes racines :**
1. La zone "situation" (`situationZone`) est mal délimitée — elle capture du texte de commentaire
2. Le format des groupes L'Équipe n'est pas reconnu : `"Gr. Van Dijke | +01'18""`, `"Van der Poel | +00'31""` — le préfixe `Gr.` et le format d'écart `+00'31"` ne matchent pas les regex
3. L'extraction des coureurs (`riderPattern`) est trop permissive et ramasse n'importe quel texte de type "Mot (parenthèse)"

### Solution — Refonte du parser situation dans l'edge function

**`supabase/functions/scrape-live-race/index.ts`** — modifier `parseLEquipeLive` :

#### 1. Améliorer la détection de la zone situation
Utiliser le DOM (pas juste le texte brut) pour trouver le bloc "situation de course" de L'Équipe. L'Équipe structure cette info dans un bloc spécifique. En fallback, affiner la zone texte en cherchant les patterns typiques de groupes (Échappée, Gr., Peloton) comme bornes.

#### 2. Élargir les regex de groupes
- Ajouter `Gr\.?\s+` comme préfixe de groupe (ex: "Gr. Van Dijke", "Gr. Vermeersch")
- Supporter le format d'écart `+00'31"` et `+01'18"` : `/\+?\s*(\d{1,2})\s*['′']\s*(\d{1,2})\s*["″"']?/`
- Un nom propre seul suivi d'un écart = un groupe (ex: "Van der Poel | +00'31"")

#### 3. Filtrer les faux positifs dans l'extraction des coureurs
- Exiger que le nom ait un format "Initial. Nom" (ex: "L. Durbridge") ou "Nom Prénom" avec initiale majuscule
- Rejeter les textes qui contiennent des mots courants français (articles, verbes, conjonctions)
- Rejeter les noms de lieux connus (collines, routes)

#### 4. Fallback robuste
Si le parser DOM/texte ne trouve pas de groupes structurés, ne PAS créer un faux groupe "peloton" avec tout le contenu. Retourner un résultat vide plutôt que des données corrompues.

### Côté affichage — aucun changement nécessaire
Le `RaceSituationDisplay` (côté ligue) et le `RaceSituationEditor` (côté SuperAdmin) fonctionnent déjà correctement. Le problème est 100% dans le scraper.

### Fichier impacté
- `supabase/functions/scrape-live-race/index.ts` — refonte de la section "Extract race situation" dans `parseLEquipeLive`

