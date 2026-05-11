## Objectif

Supprimer la fonctionnalité « Analyser avec l'IA » des effectifs de ligue : peu de valeur ajoutée, et elle expose `LOVABLE_API_KEY` à un abus (finding `analyze_rosters_no_auth`). La suppression résout le finding de sécurité sans avoir besoin d'ajouter une garde auth.

## Changements

1. **`src/components/team/LeagueRostersOverviewDialog.tsx`**
   - Retirer le bouton « Analyser avec l'IA » (lignes ~350-358) et la section d'affichage de l'analyse (lignes ~432-455).
   - Supprimer les states `analysis`, `analyzingAI`, la fonction `handleAnalyzeAI`, et les imports désormais inutilisés (`RefreshCw`, `Sparkles`/icônes de l'analyse, `supabase.functions.invoke` si plus utilisé ailleurs dans le fichier, contexte ligue chargé uniquement pour l'IA).

2. **Supprimer l'edge function** `supabase/functions/analyze-rosters/index.ts` (et son éventuel bloc de config dans `supabase/config.toml` s'il existe).

3. **Sécurité**
   - Marquer le finding `analyze_rosters_no_auth` comme corrigé via `manage_security_finding` (raison : endpoint supprimé).
   - Mettre à jour `public/publish-health.json` pour refléter la résolution.

## Hors périmètre

- Pas de modification de la logique d'affichage des effectifs eux-mêmes (la vue d'ensemble des rosters reste).
- Pas de changement de traductions (aucune clé i18n dédiée détectée pour ce bouton — texte en dur).
