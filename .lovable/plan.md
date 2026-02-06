
# Afficher les pronostics de tous les managers apres la cloture

## Contexte

Actuellement, quand un pronostic est ferme, la carte affiche uniquement "Votre choix: [coureur]". L'utilisateur ne peut pas voir ce que les autres managers ont pronostique, meme si la politique de securite (RLS) le permet deja apres la deadline.

## Ce qui va changer

Quand un pronostic est **ferme** (deadline passee), la carte affichera :
- Le pronostic du manager courant (mis en evidence)
- La liste de tous les pronostics des autres managers de la ligue, avec le nom du manager et le coureur choisi
- Un indicateur visuel si le pronostic a ete evalue (correct/incorrect)

## Implementation

### 1. Nouveau hook : `useLeaguePronostics`

Ajout dans `src/hooks/useArenaPronostics.ts` d'un hook qui recupere tous les pronostics de la ligue pour une course/etape/type donnes, uniquement quand la deadline est passee.

- Requete sur `arena_pronostics` filtree par `league_id`, `course_id`, `etape_numero`, `pronostic_type`
- Jointure avec `managers` pour obtenir le nom et l'avatar
- Jointure avec `coureurs` pour obtenir le nom du coureur
- Active uniquement si `isExpired === true`

### 2. Modification de `PronosticRaceCard.tsx`

Dans la section "fermee" de la carte (quand `isExpired` est vrai) :
- Appeler le nouveau hook `useLeaguePronostics`
- Afficher la liste de tous les pronostics avec :
  - Avatar + nom du manager
  - Nom du coureur pronostique
  - Icone correct/incorrect si evalue
  - Mise en evidence du pronostic du manager courant (bordure ou fond different)

### 3. Traductions

Ajout des cles i18n dans `fr/arena.json` et `en/arena.json` :
- `pronostics.allPicks` : "Pronostics des managers" / "Managers' picks"
- `pronostics.noPicksYet` : "Aucun pronostic pour cette course" / "No picks for this race"

## Details techniques

### Hook `useLeaguePronostics`

```typescript
// Parametres : leagueId, courseId, etapeNumero, pronosticType, enabled (deadline passee)
// Retourne : { manager_id, manager_nom, avatar_url, coureur_id, coureur_nom, is_correct }[]
```

La requete SQL sous-jacente :
- SELECT sur `arena_pronostics` avec filtre league/course/etape/type
- Jointure `managers(id, nom, avatar_url)` pour les infos manager
- Resolution des noms de coureurs via une requete secondaire sur `coureurs`
- Trie par nom de manager

### UI de la section fermee

La carte fermee affichera :
1. Un separateur avec le titre "Pronostics des managers"
2. Une liste compacte avec chaque manager :
   - Avatar miniature (h-6 w-6)
   - Nom du manager
   - Fleche vers le nom du coureur
   - Badge correct (vert) / incorrect (rouge) si evalue
3. Le pronostic du manager courant sera mis en evidence avec un fond leger et une mention "(vous)"

### Fichiers modifies

| Fichier | Modification |
|---------|-------------|
| `src/hooks/useArenaPronostics.ts` | Ajout du hook `useLeaguePronostics` + type `LeaguePronostic` |
| `src/components/arena/PronosticRaceCard.tsx` | Affichage de la liste des pronostics de tous les managers quand ferme |
| `src/i18n/locales/fr/arena.json` | Nouvelles cles de traduction |
| `src/i18n/locales/en/arena.json` | Nouvelles cles de traduction |
