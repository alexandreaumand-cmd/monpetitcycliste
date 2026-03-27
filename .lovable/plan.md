

## Fix live courses : supprimer "lecture seule" + ajouter le coureur en tête

### Problème 1 — "Ce canal est en lecture seule"
Le composant `LiveCoursesTab` passe `readOnly` au `MessageInput` (ligne 216), ce qui affiche le bandeau. Le live est en lecture seule par design (les messages viennent du broadcast admin), mais le bandeau est inutile et encombrant.

**Solution** : Supprimer le `<MessageInput>` complet du `LiveCoursesTab` (lignes 211-217). Pas besoin d'un input si le canal est en lecture seule — le bandeau n'apporte rien.

### Problème 2 — Coureur en tête manquant (Van der Poel)
Dans le scraper `parseLEquipeLive`, le leader de la course n'a **pas d'écart** (gap = 0). Or :
- Pass 1 (keywords) : ne matche pas un nom propre comme "Van der Poel"
- Pass 2 (Gr. prefix) : requiert un gap (`gapRx` est obligatoire dans la regex)
- Pass 3 (rider + gap) : requiert un séparateur `|·` suivi d'un gap

Le leader est souvent affiché seul par L'Équipe sans gap ni mot-clé, juste son nom. Il n'est donc jamais capturé.

**Solution** dans `supabase/functions/scrape-live-race/index.ts` :
- Après les 3 passes, si des groupes sont trouvés mais aucun n'a gap="0:00", chercher un nom propre **avant** le premier groupe détecté dans la zone situation (le leader est toujours listé en premier)
- Pattern : nom propre seul (sans gap, sans séparateur) dans les ~200 chars avant le premier group header
- L'insérer en position 0 avec gap="0:00"

### Fichiers impactés
- `src/components/arena/LiveCoursesTab.tsx` — supprimer le `MessageInput` readOnly
- `supabase/functions/scrape-live-race/index.ts` — ajouter détection du leader sans gap

