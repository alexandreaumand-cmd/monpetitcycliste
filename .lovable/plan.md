

## Suppression du sélecteur "Phase de départ" — détermination automatique

### Logique métier

La phase de départ ne doit plus être choisie manuellement. Elle sera déterminée automatiquement côté serveur **après la fin des enchères** (quand tous les managers ont leurs effectifs complets). À la création de la ligue, `starting_phase_index` reste `null` et sera calculé plus tard.

### Modifications

**1. Frontend — `LeagueSettingsForm.tsx`**
- Supprimer le bloc "Phase de départ" (lignes 151-185 : le `Select` des phases et la query `phases-for-league`)
- Supprimer les props `startingPhaseIndex` et `onStartingPhaseIndexChange`
- Ajouter un texte informatif sous la variante : "La phase de départ sera déterminée automatiquement à la fin des premières enchères."

**2. Frontend — `CreateLeagueDialog.tsx`**
- Supprimer le state `startingPhaseIndex` et son passage en props
- Ne plus envoyer `startingPhaseIndex` dans le body de l'appel à `leagues-create`

**3. Edge function — `leagues-create/index.ts`**
- Ne plus lire `startingPhaseIndex` du body
- Stocker `starting_phase_index = null` à la création
- La détermination automatique se fera dans un process séparé (fin des enchères)

**4. Traductions**
- Ajouter clé `settings.startingPhaseAuto` dans `fr/leagues.json` : "La phase de départ sera déterminée automatiquement à la fin des premières enchères."
- Idem en anglais

### Fichiers impactés
| Fichier | Action |
|---------|--------|
| `src/components/leagues/LeagueSettingsForm.tsx` | Supprimer sélecteur phase + query phases |
| `src/components/leagues/CreateLeagueDialog.tsx` | Supprimer state startingPhaseIndex |
| `supabase/functions/leagues-create/index.ts` | Ne plus lire startingPhaseIndex |
| `src/i18n/locales/fr/leagues.json` | Nouvelle clé |
| `src/i18n/locales/en/leagues.json` | Nouvelle clé |

