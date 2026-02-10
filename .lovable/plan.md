

## Modification du recap quotidien : mouvements startlists

Ajustement de la section "mouvements startlists" prevue dans le daily recap pour :

1. **Supprimer l'affichage de la cote** du coureur
2. **Afficher le manager proprietaire** du coureur dans la ligue concernee (via la table `rosters`)

### Logique

Dans `supabase/functions/arena-recaps/index.ts`, dans la fonction `sendDailyRecap` :

- Recuperer les changements de startlists du jour (`startlist_tracker_changes` avec `detected_at` du jour, `coureurs_saisons.prix_initial >= 50` pour le filtre)
- Pour chaque coureur detecte, joindre avec `rosters` (filtre sur `league_id`) puis `managers` pour obtenir le nom du manager proprietaire
- Si le coureur n'appartient a aucun manager, afficher "Libre"

### Format du message

```text
**Mouvements startlists :**
+ BERNAL Egan (INEOS) → Volta Catalunya — Manager: Alex
+ MAS Enric (Movistar) → Volta Catalunya — Libre
- AYUSO Juan (UAE) → Milano-Sanremo — Manager: Thomas
```

### Details techniques

Requete dans l'Edge Function :

```text
1. SELECT depuis startlist_tracker_changes 
   WHERE detected_at entre debut et fin de journee
   AND coureur_id IS NOT NULL

2. Filtrer les coureurs avec prix_initial >= 50 via coureurs_saisons 
   (join sur season_id recupere depuis league_scopes)

3. Pour chaque coureur, chercher dans rosters 
   WHERE league_id = league.id AND coureur_id = change.coureur_id
   → JOIN managers pour obtenir le nom

4. Formater : emoji + nom coureur (equipe) → course — Manager: nom ou "Libre"
```

### Fichier modifie

| Fichier | Modification |
|---|---|
| `supabase/functions/arena-recaps/index.ts` | Ajout de la section mouvements startlists dans `sendDailyRecap` avec manager au lieu de cote |

