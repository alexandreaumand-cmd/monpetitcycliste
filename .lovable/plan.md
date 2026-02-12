

# Corriger le partage des slots entre courses urgentes et non-urgentes

## Probleme

Le batch est limite a 3 courses par run (`MAX_COURSES_PER_RUN = 3`). Comme les courses urgentes (< 7 jours) sont re-eligibles toutes les 30 minutes et triees en priorite, elles monopolisent les 3 slots a chaque execution. Les courses a horizon plus lointain ne sont jamais traitees.

On le voit dans la capture : les memes courses proches (Tour de la Provence, Vuelta a la Region de Murcia, Figueira Champions Classic, etc.) tournent en boucle, et certains runs ne trouvent rien a faire (courses deja checkees il y a moins de 30min).

## Solution : slots reserves

Partager le batch en 2 groupes avec des slots dedies :

- **2 slots reserves aux courses urgentes** (< 7 jours) -- intervalle 30min
- **1 slot reserve aux courses non-urgentes** (> 7 jours) -- intervalle 6h

Si un groupe n'a pas assez de courses eligibles, ses slots vacants sont redistribues a l'autre groupe.

Cela garantit qu'a chaque run de 5 minutes, au moins 1 course lointaine est traitee (si eligible), tout en maintenant la haute frequence pour les courses imminentes.

## Fichier concerne

`supabase/functions/startlist-tracker/index.ts`

## Details techniques

### Modification dans `handleGlobalSync` (lignes ~427-444)

Remplacer le tri + slice unique par une logique de repartition :

```
const URGENT_SLOTS = 2;
const STANDARD_SLOTS = 1;
// (URGENT_SLOTS + STANDARD_SLOTS = MAX_COURSES_PER_RUN = 3)

// Separer les courses eligibles en 2 pools
const urgentPool = eligible.filter(c => isUrgentCourse(c.date_debut, now))
  .sort(byOldestCheck);
const standardPool = eligible.filter(c => !isUrgentCourse(c.date_debut, now))
  .sort(byOldestCheck);

// Remplir les slots avec redistribution si un pool est vide
let urgentPick = urgentPool.slice(0, URGENT_SLOTS);
let standardPick = standardPool.slice(0, STANDARD_SLOTS);

// Redistribuer les slots vacants
const urgentRemaining = URGENT_SLOTS - urgentPick.length;
const standardRemaining = STANDARD_SLOTS - standardPick.length;

if (standardRemaining > 0) {
  urgentPick = urgentPool.slice(0, URGENT_SLOTS + standardRemaining);
}
if (urgentRemaining > 0) {
  standardPick = standardPool.slice(0, STANDARD_SLOTS + urgentRemaining);
}

const courses = [...urgentPick, ...standardPick];
```

### Resultat attendu

Avec le cron toutes les 5 minutes :
- Courses imminentes : re-checkees toutes les ~30 min (2 par run, ~6 courses/heure)
- Courses lointaines : re-checkees toutes les ~6h (1 par run quand eligibles)
- Plus de runs "vides" consecutifs car les courses lointaines comblent les trous

### Logs ameliores

Le log existant avec les emojis sera conserve pour distinguer visuellement les deux types dans l'historique.

