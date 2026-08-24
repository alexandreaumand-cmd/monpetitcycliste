# Créer une ligue à partir d'une ligue existante

## Objectif

Ajouter une troisième entrée dans le wizard de création de ligue : « Repartir d'une ligue existante ». L'admin choisit une de ses anciennes ligues, puis ajuste tout ce qui change (mode de jeu, courses, joueurs, bonus, date d'enchère) et compose la liste des membres, qui sont ajoutés directement à la nouvelle ligue.

## Parcours utilisateur

1. **Étape 0 — Mode de création** : le sélecteur actuel (5 Phases / À la course) reçoit une 3e carte « Repartir d'une ligue existante ».
2. **Étape « Ligue source »** : liste des ligues dont je suis owner ou admin (toutes saisons, y compris terminées), avec mode de jeu, saison, nombre de membres. Sélection d'une ligue → préremplissage de tous les champs suivants.
3. **Étape « Nom et saison »** : nom prérempli (ex. « Nom de la ligue 2027 ») et modifiable, choix de la saison (permet de préparer 2027).
4. **Étape « Mode de jeu »** : le mode de la ligue source est présélectionné mais modifiable (5 Phases ou À la course). Le changement de mode adapte les étapes suivantes exactement comme dans le wizard actuel.
5. **Étape « Variante / Courses »** :
   - 5 Phases : variante (saison complète / World Tour) + phase de départ, préremplies.
   - À la course : sélecteur de courses. Si la saison change, les courses de l'ancienne saison sont remappées par nom vers la nouvelle saison quand un équivalent existe ; les courses non retrouvées sont signalées et simplement non cochées.
6. **Étape « Membres »** (nouvelle) :
   - liste des membres de la ligue source, tous cochés par défaut, décochables (moi-même, créateur, non décochable) ;
   - champ de recherche pour ajouter n'importe quel manager du site par nom ;
   - compteur « X/Y places » cohérent avec le nombre de joueurs choisi ;
   - rappel que les managers non inscrits pourront être invités via le lien d'invitation après création.
7. **Étape « Nombre de joueurs »** : présélectionné sur la ligue source, modifiable, avec un minimum égal au nombre de membres retenus.
8. **Étapes « Visibilité », « Bonus », « Date du 1er tour d'enchères »** : identiques au wizard actuel, préremplies depuis la ligue source (sauf la date, toujours à choisir).
9. **Récapitulatif** : ajoute une ligne « Ligue source » et la liste des membres ajoutés, puis création.

## Comportement à la création

- La nouvelle ligue est créée comme aujourd'hui (ligue + scope + enchère du 1er tour), en statut `pending`.
- Les membres sélectionnés sont insérés directement en tant que `member` (moi en `owner`), et `current_player_count` est mis à jour en conséquence.
- Chaque membre ajouté reçoit une notification in-app : « Tu as été ajouté à la ligue “X” ». Les préférences e-mail existantes ne sont pas modifiées.
- Aucune donnée sportive n'est copiée : ni rosters, ni enchères, ni points. Seuls les réglages et la composition humaine sont reportés.
- Les canaux de l'Arène sont créés par le mécanisme automatique déjà en place.

## Détails techniques

**Frontend**
- `src/components/leagues/LeagueTemplateSelector.tsx` : ajouter la carte « Repartir d'une ligue existante » (valeur interne `clone`, distincte du `game_mode`).
- `src/components/leagues/CreateLeagueDialog.tsx` : introduire un état `sourceLeagueId` et deux nouvelles étapes (`source`, `members`) dans `getSteps()` lorsque le parcours de clonage est actif ; un effet de préremplissage applique les réglages de la ligue source (nom, saison, mode, variante, phase de départ, courses, joueurs, visibilité, bonus).
- Nouveau composant `src/components/leagues/LeagueMembersPicker.tsx` : liste cochable des membres source + recherche de managers (debounce sur `managers.nom`), exclusion des doublons, respect de la limite de joueurs.
- Nouveaux hooks : `src/hooks/useAdminOwnedLeagues.ts` (ligues où je suis owner/admin, toutes statuts) et `src/hooks/useLeagueSourceSettings.ts` (réglages + membres + scope de la ligue source).
- Remappage des courses par nom normalisé entre saisons dans un helper `src/lib/leagues/cloneMapping.ts`.

**Backend**
- `supabase/functions/leagues-create/index.ts` : accepter `seasonId` (au lieu de toujours prendre la dernière saison), `sourceLeagueId` (stocké dans `settings.cloned_from`) et `memberUserIds`. Vérifier côté serveur que l'appelant est owner/admin de la ligue source, que les user_ids existent en `managers`, que le total ne dépasse pas `max_players`, puis insérer les `league_members` et les notifications dans la même opération, avec rollback en cas d'échec comme pour les étapes existantes.

**i18n**
- Nouvelles clés dans `src/i18n/locales/fr/leagues.json` et `en/leagues.json` : `clone.*` (titre, description, ligue source, remappage des courses), `wizard.stepSource`, `wizard.stepMembers`, `members.*`.

Aucune modification de schéma n'est nécessaire : `league_members`, `notifications` et `leagues.settings` couvrent le besoin.
