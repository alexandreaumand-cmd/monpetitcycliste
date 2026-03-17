

## Diagnostic : Lancer les enchères Phase 2 en tant qu'admin de la ligue

### Analyse du problème

Après investigation, j'ai identifié un problème principal : **la page Admin > Enchères ne réagit pas lorsqu'un admin de ligue tente de changer de phase ou lancer un round**.

La session replay montre que vous étiez sur `/dashboard/encheres` (la page joueur), pas `/dashboard/admin/encheres` (la page admin). Mais même en supposant que vous accédiez à la bonne page, plusieurs problèmes existent :

1. **Le PhaseSelector auto-sélectionne la Phase 1** (la seule phase "active" pour 2026). Quand vous changez pour Phase 2, le sélecteur peut ne pas réagir visuellement sur mobile.

2. **Un round est déjà ouvert pour Phase 2** dans la ligue MPC 2026 (round 1, deadline 19 mars). Quand un round est ouvert, le bouton "Lancer nouveau round" est masqué — seul "Clôturer" apparaît. Cela peut expliquer le "rien ne se passe".

3. **Le `onLaunch` callback passe la deadline comme un string ISO**, mais le paramètre du composant s'appelle `hours` dans l'appel `onLaunch={(hours) => openRoundMutation.mutate(hours)}` alors que la mutation attend `deadline_at`. Il y a un mismatch de type qui fait que la mutation est appelée avec un string au lieu d'un objet `{ phase_id, deadline_at }`.

### Cause racine du bug

Dans `RoundControlCenter.tsx` ligne 290 :
```typescript
onLaunch={(hours) => openRoundMutation.mutate(hours)}
```

Mais la mutation attend :
```typescript
mutationFn: async (deadlineAt: string) => {
  supabase.functions.invoke('ouvrir-nouveau-round', {
    body: { phase_id: selectedPhaseId, deadline_at: deadlineAt, league_id: leagueId }
  });
}
```

Le `RoundActions` appelle `onLaunch(deadline.toISOString())` — c'est un string ISO. Le code passe ce string directement comme `deadlineAt` dans la mutation. Ça devrait fonctionner... sauf si `leagueId` est `null`.

**Vrai problème identifié** : Si `leagueId` est `null` dans le contexte, la mutation envoie `league_id: null` à l'edge function. L'edge function exige un `league_id` pour la vérification des droits admin. Avec `null`, le check `is_league_admin(null)` retourne `false`, puis la requête `league_members` avec `league_id = null` ne trouve rien, et le serveur retourne 403. Mais l'erreur est peut-être avalée silencieusement.

### Corrections proposées

#### 1. Ajouter une garde explicite quand `leagueId` est absent
**`src/components/admin/RoundControlCenter.tsx`** : Avant de permettre le lancement, vérifier que `leagueId` est défini et afficher un toast d'erreur sinon.

#### 2. Améliorer le feedback visuel en cas d'erreur
**`src/components/admin/RoundControlCenter.tsx`** : S'assurer que les erreurs de la mutation affichent toujours un toast visible (vérifier que `supabase.functions.invoke` parse bien le body d'erreur).

#### 3. Corriger la gestion d'erreur de `supabase.functions.invoke`
`supabase.functions.invoke` ne throw PAS quand le serveur retourne un 4xx avec un body JSON. Il faut vérifier `data.error` manuellement en plus de `error`.

**Fichier modifié** :
- `src/components/admin/RoundControlCenter.tsx` (mutations openRound et closeRound)

