

# Plan: Corriger les victoires et améliorer le rendu mobile de la Comparaison

## Problème 1: Calcul des victoires incorrect

La vue SQL `v_manager_standings_by_season_v2` exclut les ex-aequo (quand plusieurs coureurs ont position=1 sur le même résultat) et filtre par `league_scopes`. Les composants de comparaison (desktop + mobile) ne font ni l'un ni l'autre :

- **Pas d'exclusion des doublons/ex-aequo** sur une même étape
- **Pas de filtrage par `etape_numero`** — deux résultats position=1 sur la même course mais étapes différentes sont traités comme une seule victoire au lieu de deux
- **Mobile : pas de filtre `league_id`** sur les rosters (utilise `supabase` brut au lieu du client scoped)

**Correction** : Remplacer les 2 queries de victoires (A et B) dans les deux fichiers par une logique alignée sur la vue :
- Filtrer `race_results` position=1, statut=finished, type_classement IN (Etape, General)  
- Joindre avec rosters filtrés par league + phase
- Exclure les résultats avec plusieurs coureurs position=1 sur le même (course, type_classement, etape_numero)

## Problème 2: Rendu mobile dégradé

- Le tableau "Points par catégorie" force `min-w-[500px]` → scroll horizontal pénible
- Pas de radar par barème (desktop en a 2, mobile n'en a qu'un)
- Les labels du radar sont trop longs et se chevauchent sur petit écran

**Amélioration mobile** :
- Remplacer le tableau scrollable par des `ComparisonMetricCard` empilées pour chaque catégorie (même design que les métriques globales)
- Ajouter la section "Points par barème" manquante en mobile
- Raccourcir les labels radar pour mobile (ex: "Courses 1 Jour" → "1J", "Courses par étapes" → "Étapes")

## Fichiers impactés

| Fichier | Action |
|---|---|
| `src/components/rankings/ManagerComparison.tsx` | Corriger queries victoires (exclure ex-aequo, ajouter etape_numero) |
| `src/components/rankings/ManagerComparison.mobile.tsx` | Corriger victoires + ajouter league filter + refonte UI catégories/barèmes |

