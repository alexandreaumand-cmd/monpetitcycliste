

## Fix : arrêter de fusionner les groupes solo — chaque `.sit-grp` PCS est un vrai groupe

### Problème

Le post-processing de fusion (lignes 250-280) considère tout groupe avec ≤1 coureur et sans nom reconnu ("breakaway", "peloton", etc.) comme un "orphelin" et le fusionne dans le groupe précédent. C'est faux : sur PCS, chaque `.sit-grp` avec son propre écart est un **groupe distinct** — un coureur seul en tête est un vrai groupe, pas un orphelin.

Résultat actuel : VINGEGAARD (solo, groupe 1) est fusionné avec le groupe 2, PARET-PEINTRE (solo) est fusionné avec le groupe suivant, etc. La structure de 8 groupes distincts est perdue.

### Solution

**Supprimer entièrement la logique de fusion orphan** (lignes 250-280). Le filtrage top-level des `.sit-grp` imbriqués (lignes 131-138) suffit déjà à isoler les vrais groupes. Chaque `.sit-grp` top-level avec son propre gap est un groupe légitime, qu'il contienne 1 ou 10 coureurs.

### Changement concret

Dans `supabase/functions/scrape-live-race/index.ts`, supprimer les lignes 250-280 (bloc `isRealGroupName` + boucle de merge + remplacement de `situationGroups`).

### Fichier impacté
- `supabase/functions/scrape-live-race/index.ts` — suppression du post-processing de fusion

