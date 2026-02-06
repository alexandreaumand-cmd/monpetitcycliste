

# Plan : L'Arene - Hub d'Interaction Sociale

## Vue d'ensemble

L'Arene est un module social complet comprenant 3 fonctionnalites principales, un Hall of Fame, et un schema dedie pour isoler les donnees sociales du systeme de classement. Le module sera accessible via un nouvel onglet "Arene" dans la navigation principale.

L'implementation sera decoupee en **3 parties distinctes**, chacune deployable independamment.

---

## PARTIE 1 : Pronostics

### Principe

Les managers peuvent parier sur les vainqueurs de courses et etapes a venir. Les pronostics sont masques des autres managers jusqu'a la cloture, et rapportent 1 point par resultat correct.

### Schema de donnees

**Nouvelles tables (schema public, prefixe `arena_`) :**

| Table | Description |
|-------|-------------|
| `arena_pronostics` | Pronostics individuels des managers |
| `arena_pronostic_deadlines` | Dates limites de pronostic par course/etape (gere par super-admin) |
| `arena_pronostic_scores` | Vue materialisee ou table de cache pour le classement |

**Table `arena_pronostic_deadlines` :**

| Colonne | Type | Description |
|---------|------|-------------|
| id | uuid PK | |
| course_id | text FK courses | Course concernee |
| etape_numero | int | null pour course d'un jour ou CG |
| pronostic_type | text | 'stage_winner', 'gc_winner', 'one_day_winner' |
| deadline_at | timestamptz | Date/heure limite pour pronostiquer |
| created_by | uuid FK managers | Super-admin qui a configure |
| created_at | timestamptz | |

**Table `arena_pronostics` :**

| Colonne | Type | Description |
|---------|------|-------------|
| id | uuid PK | |
| league_id | uuid FK leagues | Isolation par ligue |
| manager_id | uuid FK managers | Manager qui pronostique |
| course_id | text FK courses | |
| etape_numero | int | null pour course d'un jour ou CG |
| pronostic_type | text | 'stage_winner', 'gc_winner', 'one_day_winner' |
| coureur_id | text FK coureurs | Coureur pronostique |
| is_correct | boolean | null = pas encore evalue, true/false apres resultats |
| evaluated_at | timestamptz | Quand le resultat a ete evalue |
| created_at | timestamptz | |
| updated_at | timestamptz | |
| **UK** | | (league_id, manager_id, course_id, etape_numero, pronostic_type) |

### RLS

- SELECT : un manager ne voit que ses propres pronostics **OU** ceux des autres managers **apres** la deadline
- INSERT/UPDATE : seulement ses propres pronostics, et seulement avant la deadline
- DELETE : non autorise
- Les deadlines sont visibles par tous (SELECT), gerees par super-admin (INSERT/UPDATE)

### Logique backend

**Edge Function `arena-evaluate-pronostics` :**
- Declenchee apres l'import de resultats (via trigger ou appel manuel super-admin)
- Compare le vainqueur reel (1er au classement `Etape` ou `General` dans `points_ledger`) avec les pronostics
- Met a jour `is_correct` et `evaluated_at`

**Edge Function `arena-pronostic-standings` :**
- Retourne le classement des managers par ligue avec leur nombre de pronostics corrects

### Notifications

- **Notification de rappel** : un cron job (toutes les 5 min) verifie les deadlines qui arrivent dans 1h, regroupe les courses avec la meme echeance, et envoie **une seule notification** par manager
- **Nouveau type de notification** : `pronostic_reminder`
- **Preference push** : ajout de la cle `pronostics` dans les preferences utilisateur (`push_subscriptions.preferences`)

### Frontend

- **Page Arene** (`/dashboard/arene`) avec 3 onglets (Pronostics / Votes / Trash Talk)
- **Onglet Pronostics** :
  - Liste des courses a venir avec deadlines
  - Pour chaque course : combobox de selection du coureur (reutilise `CoureursCombobox` ou similaire en se basant sur la startlist)
  - Indicateur visuel (ouvert / ferme / resultat correct/incorrect)
  - Mini classement des pronostics de la ligue
- **Super-Admin** : interface pour configurer les deadlines par course/etape

### Fichiers a creer/modifier

| Fichier | Action |
|---------|--------|
| Migration SQL | Creer `arena_pronostic_deadlines`, `arena_pronostics` |
| `supabase/functions/arena-evaluate-pronostics/index.ts` | Evaluation des resultats |
| `supabase/functions/arena-pronostic-standings/index.ts` | Classement pronostics |
| `supabase/functions/arena-pronostic-reminder/index.ts` | Cron pour notifications de rappel |
| `src/pages/ArenaPage.tsx` | Page principale avec onglets |
| `src/components/arena/PronosticsTab.tsx` | Onglet pronostics |
| `src/components/arena/PronosticRaceCard.tsx` | Carte de pronostic par course |
| `src/components/arena/PronosticStandings.tsx` | Classement pronostics |
| `src/components/admin/arena/PronosticDeadlinesManager.tsx` | Config deadlines (super-admin) |
| `src/pages/Dashboard.tsx` | Ajouter route `/dashboard/arene` |
| Navigation (Header, Sidebar, MobileBottomBar) | Ajouter lien "Arene" |
| Fichiers i18n (fr/en) | Traductions arene |

---

## PARTIE 2 : Votes de la Communaute

### Principe

Sondages hebdomadaires pour elire MVP, Flop, meilleur coup tactique, pire achat, et sondages personnalises. Chaque manager vote une fois par sondage.

### Schema de donnees

**Table `arena_polls` :**

| Colonne | Type | Description |
|---------|------|-------------|
| id | uuid PK | |
| league_id | uuid FK leagues | Isolation par ligue |
| poll_type | text | 'mvp', 'flop', 'best_move', 'worst_buy', 'custom' |
| title | text | Titre du sondage |
| description | text | Description optionnelle |
| options_type | text | 'managers' (liste auto) ou 'custom' (options libres) |
| closes_at | timestamptz | Date de cloture |
| is_active | boolean | |
| created_by | uuid FK managers | Admin ligue ou super-admin |
| created_at | timestamptz | |

**Table `arena_poll_options` (pour sondages custom) :**

| Colonne | Type | Description |
|---------|------|-------------|
| id | uuid PK | |
| poll_id | uuid FK arena_polls | |
| label | text | Texte de l'option |
| manager_id | uuid FK managers | null si option custom |
| sort_order | int | Ordre d'affichage |

**Table `arena_poll_votes` :**

| Colonne | Type | Description |
|---------|------|-------------|
| id | uuid PK | |
| poll_id | uuid FK arena_polls | |
| voter_manager_id | uuid FK managers | Qui vote |
| option_id | uuid FK arena_poll_options | Option choisie |
| created_at | timestamptz | |
| **UK** | | (poll_id, voter_manager_id) -- un vote par manager |

### RLS

- Les sondages sont visibles par les membres de la ligue
- Un manager peut voter une seule fois (contrainte unique)
- Les resultats ne sont visibles qu'apres cloture du sondage
- Les admins de ligue et super-admins peuvent creer des sondages

### Logique

- Pour les types `mvp`, `flop`, `best_move`, `worst_buy` : les options sont automatiquement generees a partir des managers de la ligue
- Pour `custom` : options libres saisies par l'admin
- Les votes ne peuvent pas etre modifies une fois soumis
- Resultats visibles apres `closes_at`

### Frontend

- **Onglet Votes** dans la page Arene :
  - Liste des sondages actifs et passes
  - Interface de vote (selection d'un manager ou option)
  - Resultats avec barres de progression apres cloture
- **Admin ligue** : creation de sondages (type predetermine ou custom)

### Fichiers a creer

| Fichier | Action |
|---------|--------|
| Migration SQL | Creer `arena_polls`, `arena_poll_options`, `arena_poll_votes` |
| `src/components/arena/VotesTab.tsx` | Onglet votes |
| `src/components/arena/PollCard.tsx` | Carte de sondage |
| `src/components/arena/PollResults.tsx` | Resultats apres cloture |
| `src/components/arena/CreatePollDialog.tsx` | Dialog creation (admin) |

---

## PARTIE 3 : Fil d'actualite "Trash Talk"

### Principe

2 salons par ligue :
- `#general` : tous les membres, admins, systeme
- `#live-courses` : super-admin uniquement, clone dans toutes les ligues

### Schema de donnees

**Table `arena_channels` :**

| Colonne | Type | Description |
|---------|------|-------------|
| id | uuid PK | |
| league_id | uuid FK leagues | |
| slug | text | 'general' ou 'live-courses' |
| created_at | timestamptz | |
| **UK** | | (league_id, slug) |

**Table `arena_messages` :**

| Colonne | Type | Description |
|---------|------|-------------|
| id | uuid PK | |
| channel_id | uuid FK arena_channels | |
| league_id | uuid FK leagues | Denormalise pour RLS rapide |
| author_manager_id | uuid FK managers | null pour messages systeme |
| message_type | text | 'user', 'system', 'admin_local', 'admin_broadcast' |
| content | text | Contenu du message |
| metadata | jsonb | Donnees extra (coureur, montant, course...) |
| source_message_id | uuid | null ou id du message original (pour clones) |
| created_at | timestamptz | |

**Table `arena_reactions` :**

| Colonne | Type | Description |
|---------|------|-------------|
| id | uuid PK | |
| message_id | uuid FK arena_messages | |
| manager_id | uuid FK managers | |
| emoji | text | Code emoji (fire, laugh, trophy, thumbsup, skull) |
| created_at | timestamptz | |
| **UK** | | (message_id, manager_id, emoji) |

### Trigger de clonage automatique

Un trigger PostgreSQL sur `arena_messages` : quand un message `admin_broadcast` est insere dans un canal `#live-courses`, il est automatiquement clone dans tous les canaux `#live-courses` de chaque ligue active (sauf celle d'origine).

### Realtime

- Activer `supabase_realtime` sur `arena_messages` et `arena_reactions` pour les mises a jour en temps reel

### Messages systeme automatiques

Des triggers existants (resultats, encheres) pourront etre completes pour inserer des messages automatiques dans `#general` lors d'evenements marquants :
- Gros recrutements (montant > seuil)
- Victoires d'etapes majeures
- Classements notables

Cela sera fait dans un second temps pour ne pas surcharger cette premiere implementation.

### Mentions

- Syntaxe `@manager_nom` et `@tous`
- Detection cote client au moment de la saisie
- Les mentions declenchent des notifications push

### Frontend

- **Onglet Trash Talk** dans la page Arene :
  - Selecteur de canal (#general / #live-courses)
  - Fil de messages avec scroll infini
  - Zone de saisie avec support mentions
  - Boutons de reactions emoji sous chaque message
  - Badge de messages non lus
- Messages systeme avec style visuel distinct (icone, couleur)

### Fichiers a creer

| Fichier | Action |
|---------|--------|
| Migration SQL | Creer `arena_channels`, `arena_messages`, `arena_reactions` + trigger clonage |
| `src/components/arena/TrashTalkTab.tsx` | Onglet principal |
| `src/components/arena/MessageBubble.tsx` | Composant message |
| `src/components/arena/MessageInput.tsx` | Zone de saisie avec mentions |
| `src/components/arena/ReactionBar.tsx` | Barre de reactions |
| `src/components/arena/ChannelSelector.tsx` | Selecteur de canal |
| `src/hooks/useArenaMessages.ts` | Hook realtime pour les messages |

---

## Hall of Fame

### Principe

Classement des managers par "Points de Prestige" accumules via l'activite sociale :
- +1 point par pronostic correct
- +2 points pour un vote MVP recu
- +1 point pour une reaction recue sur un message
- Bonus configurable par le super-admin

### Schema

**Table `arena_prestige_points` :**

| Colonne | Type | Description |
|---------|------|-------------|
| id | uuid PK | |
| league_id | uuid FK leagues | |
| manager_id | uuid FK managers | |
| points | int | |
| source_type | text | 'pronostic', 'vote_received', 'reaction_received', 'bonus' |
| source_id | uuid | Reference vers l'element source |
| created_at | timestamptz | |

### Frontend

- Section "Hall of Fame" accessible depuis la page Arene (ou en tant qu'onglet/section)
- Classement avec avatar, nom, points de prestige
- Badges ou titres pour le top 3

---

## Navigation et Integration

### Ajout dans la navigation

L'onglet "Arene" sera ajoute dans :
- **Desktop sidebar** (`AppSidebar.tsx`) : nouvel item avec icone `Swords` ou `Flame`
- **Mobile bottom bar** (`MobileBottomBar.tsx`) : a evaluer (5 items max, possibilite de remplacer ou utiliser le drawer)
- **Header desktop** (`Header.tsx`) : nouvel onglet
- **Route** : `/dashboard/arene`

### Structure de la page Arene

```text
ArenaPage
  +-- Tabs
       +-- PronosticsTab
       +-- VotesTab
       +-- TrashTalkTab
       +-- (HallOfFame section)
```

---

## Ordonnancement recommande

Voici l'ordre d'implementation suggere :

1. **Phase 1** : ✅ Schema de base (toutes les tables) + navigation + page squelette — DONE
2. **Phase 2** : ✅ Pronostics (edge functions, UI complète, notifications, deadlines admin, cron reminder) — DONE
3. **Phase 3** : ✅ Trash Talk (realtime, UI, trigger clonage, @mentions, reactions emoji) — DONE
4. **Phase 4** : Votes (UI admin, UI vote)
5. **Phase 5** : Hall of Fame (triggers d'attribution, classement)

Cet ordre priorise les pronostics (plus de valeur immediate) et le trash talk (engagement social), avant les votes et le prestige.

---

## Estimation globale

| Partie | Complexite | Tables | Edge Functions |
|--------|-----------|--------|----------------|
| Pronostics | Moyenne-Haute | 2 | 3 (evaluation, standings, cron reminder) |
| Votes | Moyenne | 3 | 0-1 |
| Trash Talk | Haute | 3 | 1 (trigger clone) |
| Hall of Fame | Faible | 1 | 1 |
| **Total** | | **9 tables** | **4-5 edge functions** |

---

## Securite

- Toutes les tables auront RLS active
- Isolation stricte par `league_id` sur toutes les requetes
- Les pronostics sont masques entre managers via une policy RLS utilisant la deadline
- Les votes sont proteges par contrainte unique
- Le canal `#live-courses` est en ecriture super-admin uniquement

