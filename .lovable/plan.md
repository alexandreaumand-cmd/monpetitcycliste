
# Plan : Ligue par défaut choisie par l'utilisateur

## Probleme identifie

Quand un utilisateur fait partie de plusieurs ligues, l'application selectionne automatiquement la **premiere ligue retournee** par la base de donnees (souvent par ordre alphabetique). Ainsi, "Early Adopters" est toujours selectionnee avant "MPC 2026", quel que soit le contexte de la notification.

De plus, quand on clique sur une notification de resultats, le code **force la ligue courante** au lieu de celle de la notification :
```
const leagueId = currentLeagueId || notification.metadata?.league_id;
```

## Solution proposee

Approche simple et efficace en **3 volets** :

### 1. Sauvegarder la preference en base de donnees

Ajouter une colonne `preferred_league_id` (nullable) dans la table `managers`. Quand un utilisateur choisit sa ligue par defaut dans ses parametres, on l'enregistre ici.

**Migration SQL :**
```sql
ALTER TABLE managers ADD COLUMN preferred_league_id uuid REFERENCES leagues(id) ON DELETE SET NULL;
```

### 2. Utiliser cette preference a l'initialisation

Modifier le `LeagueContext.tsx` pour prioriser la ligue preferee quand aucun `leagueId` n'est dans l'URL :

| Priorite | Source |
|----------|--------|
| 1 | `leagueId` present dans l'URL |
| 2 | `preferred_league_id` du profil manager |
| 3 | Premiere ligue active (comportement actuel) |

### 3. Ajouter le selecteur dans les parametres du compte

Ajouter une nouvelle section "Ligue par defaut" dans la page Compte (`AccountPage.tsx`) avec un selecteur listant toutes les ligues de l'utilisateur.

## Corrections supplementaires

- **Notifications de startlist** : le clic utilise deja `notification.metadata?.league_id` -- c'est correct.
- **Notifications de resultats** : inverser la priorite pour utiliser `notification.metadata?.league_id` en premier, avec un fallback sur `currentLeagueId`. Cela permettra d'ouvrir directement dans la bonne ligue.

## Fichiers a modifier

| Fichier | Modification |
|---------|-------------|
| Migration SQL | Ajouter la colonne `preferred_league_id` a `managers` |
| `src/contexts/LeagueContext.tsx` | Charger `preferred_league_id` et l'utiliser comme priorite 2 |
| `src/pages/AccountPage.tsx` | Ajouter la section "Ligue par defaut" avec un selecteur |
| `src/components/layout/NotificationCenter.tsx` | Inverser la priorite ligue dans le clic sur notification resultats |
| `src/i18n/locales/fr/account.json` | Ajouter les traductions pour "Ligue par defaut" |
| `src/i18n/locales/en/account.json` | Ajouter les traductions pour "Default League" |

## Details techniques

### LeagueContext.tsx - Logique modifiee

```text
1. URL a un leagueId ? -> l'utiliser
2. Sinon, charger le profil manager
3. Si preferred_league_id existe ET fait partie des ligues actives -> l'utiliser
4. Sinon -> premiere ligue active (comportement actuel)
```

### AccountPage.tsx - Nouvelle section

Une carte "Ligue par defaut" avec :
- Un selecteur (Select) listant les ligues actives de l'utilisateur
- Une option "Aucune preference" pour revenir au comportement automatique
- Sauvegarde immediate en base au changement

### NotificationCenter.tsx - Correction

```text
// Avant (problematique) :
const leagueId = currentLeagueId || notification.metadata?.league_id;

// Apres (corrige) :
const leagueId = notification.metadata?.league_id || currentLeagueId;
```

## Estimation

- **Complexite** : Faible
- **Risque** : Minimal (ajout d'une colonne nullable, pas de changement destructif)
