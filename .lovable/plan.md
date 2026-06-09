
## Diagnostic

Sur l'étape 3 du Tour Auvergne - Rhône-Alpes (TTT du 09/06), la liste des équipes proposée dans le combobox de pronostic est construite par le hook `useStartlistTeams` (`src/hooks/useArenaPronostics.ts`). Ce hook :

1. Récupère les valeurs distinctes de `startlist_entries.source_team` (texte brut importé, ex: `"Netcompany INEOS (WT)"`).
2. Tente de les rapprocher des `equipes_saisons` de la saison par comparaison de chaînes (égalité, trigramme, ou `includes` dans un sens ou l'autre sur `nom_affiche`).

En testant cette logique sur la startlist actuelle (22 équipes), **5 équipes ne sont jamais rapprochées** car la chaîne `source_team` (avec le suffixe `(WT)/(PRT)` et des variantes d'orthographe / espaces) ne correspond pas exactement au `nom_affiche` :

- Lotto Intermarché (WT)
- Soudal Quick-Step (WT)
- Team Jayco AlUla (WT)
- TotalEnergies (PRT)
- (et selon la fenêtre d'import, potentiellement d'autres)

Dans la simulation SQL, **Netcompany INEOS est bien candidate** au matching, donc en théorie elle devrait apparaître. Mais le matching repose sur une heuristique fragile (sensible à la casse, aux espaces, aux suffixes, à un éventuel doublon `usedIds` côté équipes_saisons) — et l'utilisateur ne la voit pas. Il faut remplacer cette heuristique par une dérivation déterministe.

## Correctif proposé

Réécrire `useStartlistTeams` pour dériver la liste des équipes **à partir des coureurs déjà matchés dans la startlist**, plutôt que par fuzzy-matching de `source_team` :

1. Charger les `startlist_entries` du dernier import (`startlist_id`) avec `coureur_id NOT NULL`.
2. Joindre `coureurs_saisons` sur `(coureur_id, saison_id)` pour récupérer `equipe_saison_id`.
3. Joindre `equipes_saisons` pour récupérer `id` + `nom_affiche`.
4. Déduplifier par `equipe_saison_id`, trier par `nom_affiche`.
5. **Fallback** : pour les entries sans coureur matché, conserver l'heuristique actuelle sur `source_team` afin de ne pas perdre d'équipe — mais en complément, pas en remplacement.

Aucun changement de schéma. Aucun changement d'UI (le combobox `PronosticStartlistTeamCombobox` consomme déjà `{ equipe_saison_id, nom_affiche }`).

## Vérifications

- Sur le Tour Auvergne - Rhône-Alpes, la liste doit contenir les 22 équipes, dont **NETCOMPANY INEOS**, Lotto Intermarché, Soudal Quick-Step, Team Jayco AlUla, TotalEnergies.
- Le pronostic existant éventuel reste sélectionné via `equipe_saison_id`.
- Recharger l'Arène → Pronostics → étape 3 et vérifier que Netcompany INEOS est sélectionnable.

## Détails techniques

- Fichier modifié : `src/hooks/useArenaPronostics.ts` (fonction `useStartlistTeams`).
- Requête principale :
  ```ts
  supabase
    .from('startlist_entries')
    .select('coureur_id, source_team, coureurs_saisons!inner(equipe_saison_id, saison_id, equipes_saisons!inner(id, nom_affiche))')
    .eq('startlist_id', importData.id)
    .eq('coureurs_saisons.saison_id', importData.saison_id)
    .not('coureur_id', 'is', null)
  ```
- Garder le tri alphabétique sur `nom_affiche` et la clé React-Query inchangée.
