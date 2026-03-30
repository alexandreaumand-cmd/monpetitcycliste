

## Optimisation : suppression du doublon "joueurs" sur la LeagueCard

### Probleme
Sur les cartes en statut "En attente", le nombre de joueurs apparait deux fois :
1. Dans le header (ligne 131-138) via `LeagueParticipantsHover`
2. Dans le contenu, section "Joueurs inscrits" (ligne 146-157) avec un second `LeagueParticipantsHover`

### Proposition
Garder **un seul endroit** pour le compteur de joueurs : le header (ligne 2 des badges). Supprimer la ligne "Joueurs inscrits" + le second `LeagueParticipantsHover` dans les sections `isWaitingForPlayers` et `isReadyToLaunch`. La liste des membres reste visible directement dans la carte sans le titre redondant.

### Changements — `src/components/dashboard/LeagueCard.tsx`

1. **Section `isWaitingForPlayers`** (lignes 145-157) : supprimer le bloc `<div className="flex items-center justify-between">` contenant le titre "Joueurs inscrits" et le second `LeagueParticipantsHover`. Garder uniquement la liste des membres et le bloc "Places restantes".

2. **Section `isReadyToLaunch`** (lignes 212-224) : idem, supprimer le titre "Joueurs inscrits" + le second `LeagueParticipantsHover`.

### Resultat attendu
- Header : badges (mode, saison, bonus) + `👥 1 joueur` cliquable/hoverable (une seule fois)
- Contenu : liste des noms directement, places restantes, bouton invitation
- Zero redondance

