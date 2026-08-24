# Préparer la saison 2027 à l'avance

Objectif : pouvoir créer la saison 2027 et ses phases dès maintenant, sans qu'elle devienne « saison en cours », puis la lancer manuellement (ou laisser la date la lancer automatiquement, comme aujourd'hui).

## Situation actuelle

- Créer une saison (bouton « Créer la saison ») n'a aucun effet visible ailleurs : une saison sans phase apparaît simplement dans « Saisons à venir ». C'est donc déjà sans risque.
- Le problème vient des phases : le formulaire de création de phase force le statut `active`, même avec des dates futures. Une phase 2027 créée aujourd'hui rendrait immédiatement 2027 « saison en cours » (les indicateurs de phase se basent sur la phase active la plus récente).
- La bascule automatique par date (tâche planifiée) active une phase quand `date_debut <= aujourd'hui <= date_fin` et la termine après `date_fin`. Une phase 2027 avec des dates 2027 ne serait donc pas activée avant l'heure — à condition de ne pas être créée « active » à la main.

## Ce qui sera mis en place

### 1. Création de phases en brouillon
- Le formulaire de création de phase crée désormais la phase en statut **Brouillon** par défaut (choix possible : Brouillon / Active).
- Chaque phase brouillon affiche un bouton **« Lancer la phase »** (passage en active) et un bouton pour revenir en brouillon si lancée par erreur.
- La bascule automatique à la date est conservée telle quelle : une phase brouillon dont la date de début arrive passera automatiquement en active.

### 2. Affichage « saison à venir » fiable
- Une saison dont toutes les phases sont en brouillon est classée dans « Saisons à venir » (aujourd'hui elle basculerait en « en cours »).
- Badges de statut par phase : Brouillon / Active / Terminée, avec les dates.

### 3. Duplication des données depuis 2026
Nouveau bloc « Préparer une saison » dans l'onglet Saisons, avec saison source (2026) et saison cible (2027), et trois cases à cocher indépendantes :
- **Équipes** : copie des équipes de la saison (nom affiché, catégorie, trigramme, actif).
- **Barèmes** : copie des règles de points de la saison.
- **Coureurs** : copie des rattachements coureur/équipe et prix initiaux (à ajuster ensuite via l'import habituel ou l'écran Coureurs).

Chaque copie est idempotente (relancer n'ajoute pas de doublons) et affiche le nombre de lignes créées / ignorées.

### 4. Import Excel des côtes (prix initiaux) en masse
Après la copie en masse des coureurs, un outil « Mettre à jour les côtes » dans l'onglet Saisons :
- Export d'un modèle Excel/CSV pré-rempli avec les coureurs de la saison cible : `coureur_id`, `nom`, `equipe`, `prix_initial` actuel.
- Ré-import du fichier modifié (xlsx ou csv) : aperçu avant validation, avec pour chaque ligne l'ancien prix, le nouveau prix, et le statut (inchangé / modifié / coureur inconnu).
- Bouton « Appliquer » qui met à jour `coureurs_saisons.prix_initial` (et `equipe_id` si la colonne équipe est renseignée et reconnue) pour la saison cible uniquement.
- Garde-fous : refus si la saison a déjà une phase active avec des enchères ouvertes, journal du nombre de lignes modifiées.

### 5. Suivi des transferts PCS (validation manuelle)
La page PCS fournie est exploitable : tableau avec Published / Rider / From / Goes to / Season, et les slugs PCS du coureur et des équipes (≈170 lignes sur 120 jours). Les transferts « arrivée sans club de départ » sont fréquents (colonne From vide) — ils seront traités comme « nouvelle recrue ».

- Nouvelle table `rider_transfers` : date de publication, nom PCS du coureur, slug PCS, équipe de départ (nom + slug), équipe d'arrivée (nom + slug), saison cible, coureur rattaché (nullable), équipe d'arrivée rattachée (nullable), statut (`nouveau`, `appliqué`, `ignoré`), horodatages. Clé unique sur (slug coureur, slug équipe d'arrivée, saison) pour ne jamais dupliquer.
- Nouvelle fonction edge `scrape-pcs-transfers` (via l'utilitaire `pcsFetch` déjà en place) exécutée une fois par jour par tâche planifiée : parse le tableau, insère uniquement les nouveautés, tente un rapprochement automatique coureur (via `coureurs` + `name_aliases`) et équipe (via `equipes_saisons`), et laisse le statut `nouveau`.
- Nouvel écran super-admin « Transferts » : liste des transferts non traités (badge du nombre de nouveautés), filtres par saison / statut, bouton de scraping manuel.
- Pour chaque ligne : validation manuelle avec sélection du coureur (recherche + création d'alias si le nom PCS diffère), sélection de l'équipe d'arrivée, puis « Appliquer » → met à jour/crée le rattachement `coureurs_saisons` pour la saison cible. Boutons « Ignorer » et « Réinitialiser ».
- Si l'équipe d'arrivée n'existe pas : bouton « Créer l'équipe » directement depuis la ligne (nom, trigramme, catégorie, saison cible) → création dans `equipes` + `equipes_saisons`, puis rattachement immédiat.

## Procédure à suivre ensuite (résumé pour vous)

1. Onglet Saisons → « Créer la saison 2027 ».
2. Bloc « Préparer une saison » → source 2026, cible 2027, cocher Équipes + Barèmes (+ Coureurs), lancer.
3. Export du modèle de côtes, ajustement dans Excel, ré-import et application.
4. Onglet Transferts → valider les transferts PCS un par un (créer les équipes manquantes si besoin).
5. Créer les phases 2027 avec leurs dates et budgets — elles restent en **Brouillon**.
6. Créer les courses de chaque phase, planifier les enchères si besoin.
7. Le jour J : soit cliquer sur « Lancer la phase », soit laisser la bascule automatique le faire à la date de début.


## Détails techniques

- `src/components/admin/SeasonManager.tsx` : statut par défaut `draft` à l'insertion de phase, sélecteur de statut, actions Lancer / Remettre en brouillon, catégorisation « à venir » basée sur l'absence de phase active, badges de statut.
- Nouveau composant `src/components/admin/SeasonPrepareManager.tsx` monté dans l'onglet Saisons.
- Nouvelle fonction SQL `clone_season_data(p_source_saison uuid, p_target_saison uuid, p_equipes bool, p_baremes bool, p_coureurs bool)` (SECURITY DEFINER, réservée aux super-admins) qui insère dans `equipes_saisons`, `scoring_rules_saisons` et `coureurs_saisons` avec `ON CONFLICT DO NOTHING`, et renvoie le décompte par table.
- Aucun changement de la tâche planifiée `auto_update_phase_statuts` (comportement automatique conservé).
- Nouveau composant `src/components/admin/SeasonPricesImport.tsx` : export du modèle et import xlsx/csv (via `xlsx`), aperçu diff puis application par lots sur `coureurs_saisons`.
- Nouvelle table `public.rider_transfers` (RLS : lecture/écriture super-admin uniquement, GRANT `authenticated` + `service_role`), avec index unique anti-doublon.
- Nouvelle fonction edge `supabase/functions/scrape-pcs-transfers/index.ts` utilisant `_shared/pcsFetch.ts`, parsing de `table.basic` (colonnes Published / Rider / From / Goes to / Season + slugs des liens `rider/...` et `team/...-<annee>/transfers`), upsert `ON CONFLICT DO NOTHING`, paramètre `days` (défaut 120).
- Tâche planifiée quotidienne (pg_cron + pg_net) appelant cette fonction.
- Nouveau composant `src/components/admin/TransfersManager.tsx` (onglet dans la section Données) : liste, rapprochement coureur/équipe, création d'équipe, application vers `coureurs_saisons`, création d'alias dans `name_aliases`.
