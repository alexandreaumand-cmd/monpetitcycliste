# Doublons dans la Timeline live

## Ce qui se passe

Vérifié en base sur l'étape en cours : les deux évènements en double existent bien deux fois, avec des identifiants différents :

- `🔧 KRUIJSWIJK Steven fait le relais…` → publié à 16:00 avec l'identifiant `848089`, puis republié à 16:05 avec `848089#steven-kruijswijk`
- `🚀 Attaque de HAYTER Ethan…` → une première version sans « dans le peloton », puis `847993#ethan-hayter`

Cause : lors de l'ajout du support multi-coureurs, la clé d'unicité d'un évènement est passée de `uid` à `uid#slug-du-coureur`. Les évènements déjà publiés avant ce changement ne sont donc plus reconnus comme déjà diffusés et sont republiés une seconde fois (avec le libellé enrichi).

Second risque identifié dans le même code : la liste des évènements déjà publiés est lue avec `limit(500)` sur toutes les ligues confondues. Comme chaque évènement est inséré une fois par ligue diffusée (7 ligues actuellement), cette fenêtre ne couvre qu'environ 70 évènements par course — sur une étape longue, les plus anciens sortent de la fenêtre et peuvent être republiés.

## Correction proposée

1. **Clé d'unicité stable** : dédupliquer sur une clé insensible au format d'`uid` (type d'évènement + coureur + km restants) en plus de l'`uid`. Ainsi un même évènement déjà publié sous un ancien identifiant n'est jamais republié, même si le parseur évolue à nouveau.
2. **Fenêtre de déduplication fiable** : lire les identifiants déjà publiés sans plafond trompeur (identifiants distincts pour la course, sur toute la durée de l'étape) au lieu des 500 dernières lignes toutes ligues confondues.
3. **Nettoyage** : supprimer les messages Timeline en double déjà présents pour l'étape en cours (on conserve la version la plus complète, celle avec le libellé de groupe).

## Détails techniques

- `supabase/functions/live-broadcast-auto-scrape/index.ts` : construction d'un `dedupKey` (`type|coureur|km`) côté publication, comparé à un ensemble alimenté par les `metadata->>live_event_uid` **et** `live_event_type` / mentions existants ; requête de lecture des publiés basée sur les identifiants distincts de la course.
- Nettoyage via une requête SQL ciblée sur `arena_messages` : suppression des lignes dont l'`uid` est un préfixe d'un autre `uid` publié plus tard pour la même course (ex. `848089` vs `848089#steven-kruijswijk`).
- Aucun changement d'UI nécessaire.
