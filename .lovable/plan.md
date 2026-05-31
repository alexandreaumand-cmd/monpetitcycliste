## Diagnostic

Sur la page PCS du Tour de Wallonie 2026, la startlist est marquée **"Preliminary startlist"**. PCS affiche 119 coureurs (le compteur officiel : `<b>119</b> riders`), mais le HTML contient **136 entrées** car certaines équipes annoncent **plusieurs candidats pour un même dossard** en attendant la confirmation finale.

Exemple Red Bull - BORA - hansgrohe :
- bib 54 → MEEUS Jordi
- bib 54 → **MARTÍNEZ Daniel Felipe** ← le coureur "fantôme"

Chaque équipe a un dossard dédoublé (1 coureur de réserve), d'où l'écart 17 équipes × 1 = **17 coureurs en trop** (119 + 17 = 136).

La fonction `parseStartlistHtml` (`supabase/functions/startlist-tracker/index.ts`, l. 975) lit tous les `<a href="rider/...">` sans aucun filtre, donc inclut les réserves. Aucune classe CSS ne distingue le titulaire du réserviste — les deux sont des `<li class=" ">`.

## Fix proposé

Dans `parseStartlistHtml` (et le fallback) :

1. **Extraire le dossard** de chaque `<li>` via `li > span.bib`.
2. **Dédupliquer par (équipe, bib)** : pour chaque équipe, ne conserver que le **premier coureur** rencontré pour un bib donné (les réservistes apparaissent toujours après le titulaire dans le HTML PCS).
3. **Optionnel — garde-fou** : lire le total déclaré par PCS (`div.right.fs11 b` = "119") ; logguer un warning et activer le déduplicate seulement si `parsed > declared`. Sinon comportement inchangé pour les startlists finales sans doublon.
4. **Logs** : indiquer combien de réservistes ont été filtrés et lesquels (nom + bib + équipe), pour traçabilité.

## Comportement côté `syncStartlist`

Aucun changement nécessaire — il recevra 119 coureurs au lieu de 136 et fera son diff normalement. Si l'équipe confirme plus tard un autre titulaire, le tracker détectera l'ajout/retrait au prochain run.

## Fichiers touchés

- `supabase/functions/startlist-tracker/index.ts` — fonction `parseStartlistHtml` uniquement.

Aucune migration, aucun changement UI.
