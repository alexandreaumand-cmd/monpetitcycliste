## ✅ Fix complet : effective_phase_id sur les enchères (implémenté)

### Changements effectués

1. **Migration SQL** : ajout colonne `effective_phase_id uuid` sur `auctions` + backfill avec `phase_id`
2. **`leagues-create`** : accepte `startingPhaseIndex`, crée l'auction avec `effective_phase_id` figé
3. **`clore-round`** : suppression résolution dynamique de phase, utilise `auction.effective_phase_id ?? auction.phase_id`
4. **`ouvrir-nouveau-round`** : accepte et persiste `effective_phase_id` sur les nouvelles auctions
5. **`publier-annonce`** : propage `effective_phase_id` lors de l'auto-lancement du round suivant
6. **UI création de ligue** : sélecteur de phase de départ (Phase 1-5) pour les ligues five_phases
7. **Fix TS** : hint FK `phases!auctions_phase_id_fkey` dans AnnouncementManager (ambiguïté 2 FK)
