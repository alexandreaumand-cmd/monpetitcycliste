# Corriger la situation de course PCS (live)

## Problème observé

Sur le panneau Live (capture 1), la situation du Tour de Romandie affiche 9 "groupes" : Pogacar, Nordhagen, Lipowitz, Martinez, Roglic, Tuckwell, Withen, Cepeda, Rodríguez — chacun listé comme un groupe avec un écart entre eux.

Côté PCS (capture 2), il n'existe en réalité que **2 groupes** :
- `GROUP POGACAR` (4 coureurs, en tête)
- `GROUP ROGLIC` à +0:26 (10+ coureurs)

Le scraper traite chaque **ligne de coureur** comme si elle était un groupe.

## Cause racine

Dans `supabase/functions/scrape-live-race/index.ts` (parsing PCS Live), la structure HTML PCS imbrique des `.sit-grp` à plusieurs niveaux :

```
.sit-grp                  ← vrai groupe (POGACAR)
  ├─ header (nom, gap)
  ├─ .sit-grp             ← ligne coureur (1 rider)
  ├─ .sit-grp             ← ligne coureur (1 rider)
  └─ ...
.sit-grp                  ← vrai groupe (ROGLIC)
  └─ ...
```

La logique actuelle :
1. Cherche le **premier** `.sit-grp` sans ancêtre `.sit-grp` (= root unique).
2. Prend ses enfants directs `.sit-grp` comme "groupes".

Quand chaque vrai groupe est lui-même un root (frères au top-level), `find()` n'en retourne qu'un seul, et ses enfants directs sont les **lignes de coureurs**, pas des sous-groupes. Résultat : 9 "groupes" d'un coureur chacun.

## Correction

### 1. Repenser la sélection des "vrais groupes"

Remplacer la logique `rootSitGrp + children` par : **tous les `.sit-grp` qui contiennent plusieurs liens coureur ET ont un header (nom de groupe ou écart `+M:SS`)** sont de vrais groupes. Un `.sit-grp` qui ne contient qu'un seul `<a href*="rider/">` est une ligne de coureur, pas un groupe — on l'ignore.

Algorithme :
- Récupérer **tous** les `.sit-grp` du document.
- Pour chacun, compter les `a[href*="rider/"]` directement contenus (en excluant ceux dans des `.sit-grp` descendants).
- Garder uniquement ceux avec ≥ 2 liens coureur OU un nom de groupe explicite (`GROUP …`, `Peloton`, `Head of the race`, etc.).
- Si après filtrage on a 0 vrai groupe mais N `.sit-grp` totaux, fallback : prendre tous les `.sit-grp` top-level (sans ancêtre `.sit-grp`) comme groupes — chacun étant alors un vrai groupe distinct.

### 2. Conserver la logique d'extraction des coureurs

L'extraction interne (riders, bibs, GC gaps) reste correcte pour un vrai groupe. Le filtre "exclure les liens des `.sit-grp` descendants" garde son sens car les coureurs sont eux-mêmes des sous-`.sit-grp`.

### 3. Logs de diagnostic enrichis

Ajouter des logs côté edge function :
- nombre total de `.sit-grp`
- nombre de `.sit-grp` "racine" (sans ancêtre)
- nombre retenu comme vrais groupes
- pour chaque groupe retenu : nom, écart, nombre de coureurs

Ces logs permettront de valider en conditions réelles la prochaine fois qu'un live PCS sera actif.

### 4. Test sur l'admin Live Broadcast

Une fois déployé, l'admin pourra rescraper la même URL PCS et vérifier dans la fenêtre de prévisualisation (capture 1) que la situation affiche bien 2 groupes au lieu de 9, alignée avec PCS (capture 2).

## Fichier modifié

- `supabase/functions/scrape-live-race/index.ts` — section `parsePCSLive` (lignes ~115–268)

## Hors scope

- Affichage `RaceSituationDisplay` : inchangé (il affiche correctement ce qu'on lui donne).
- Parsers L'Équipe et FirstCycling : inchangés.
- Pas de migration DB.
