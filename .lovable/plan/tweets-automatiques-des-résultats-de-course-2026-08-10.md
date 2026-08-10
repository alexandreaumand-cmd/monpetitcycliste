# Tweets automatiques des résultats de course

Publier automatiquement un tweet sur le compte X (Twitter) du jeu dès qu'un résultat d'étape ou de classement général est enregistré, avec une image du classement et des hashtags.

## Ce que verra le public

Tweet type :

```text
🏁 Tour de France — Étape 12
1. Tadej POGACAR (UAE Team Emirates) — 120 pts
2. ...
Tous les points sur Labordure.app
#labordure_lejeu #TourdeFrance
```

+ une image générée (visuel maison, couleurs du site) contenant :
- en-tête : nom de la course, étape ou « Classement général », date
- top 10 : position, nom du coureur, équipe, points marqués dans le jeu
- pied de page : logo / Labordure.app

Les points affichés viennent des points du jeu déjà calculés pour cette étape/ce classement (barème officiel), donc le tweet ne part qu'après le calcul des points.

## Déclenchement

Automatique, sans validation :
- enregistrement d'une étape (saisie manuelle desktop et mobile, import CSV, lot de résultats)
- enregistrement du classement général d'une course à étapes
- résultat d'une course d'un jour

Garde-fous :
- une seule publication par (course, étape ou GC) — anti-doublon en base ; une nouvelle saisie sur la même étape ne re-tweete pas
- étape annulée → pas de tweet
- si l'API X échoue, la tentative est enregistrée avec l'erreur et peut être relancée depuis le superadmin

## Écran superadmin « Tweets »

Une page superadmin dédiée pour garder le contrôle :
- historique des tweets (course, étape, statut envoyé/erreur, lien vers le tweet, aperçu de l'image)
- interrupteur global « publication automatique activée / désactivée »
- bouton « Relancer » sur un tweet en erreur, et « Publier » manuellement pour une course/étape déjà saisie

## Détails techniques

### Accès à l'API X
Publier un tweet exige un accès en écriture au compte : le connecteur X de la plateforme est en lecture seule, il faut donc des identifiants d'application X (portail développeur X, app en « Read and Write », OAuth 1.0a).
4 secrets à fournir : `TWITTER_CONSUMER_KEY`, `TWITTER_CONSUMER_SECRET`, `TWITTER_ACCESS_TOKEN`, `TWITTER_ACCESS_TOKEN_SECRET`. Je les demanderai via le formulaire sécurisé à l'étape d'implémentation.
Appels : `POST https://upload.x.com/1.1/media/upload.json` (image) puis `POST https://api.x.com/2/tweets` avec `media.media_ids`.

### Base de données
Nouvelle table `tweet_posts` : `course_id`, `etape_numero` (null = GC), `kind` (`stage` | `gc` | `oneday`), `status` (`pending`|`sent`|`error`), `tweet_id`, `text`, `error`, `image_path`, timestamps. Index unique sur (`course_id`, `etape_numero`, `kind`). GRANT + RLS : lecture/écriture réservées aux superadmins, accès complet `service_role`.
Ajout d'un flag dans `app_feature_flags` pour l'interrupteur global.

### Nouvelle edge function `tweet-race-result`
1. valide l'entrée (`course_id`, `etape_numero`, `kind`), vérifie le flag et l'anti-doublon
2. lit la course (`courses`), le top 10 (`race_results` + `coureurs` + équipe via `coureurs_saisons`/`equipes_saisons`) et les points (`points_ledger` filtré sur course/étape/type de classement)
3. compose l'image : rendu SVG maison → PNG via `resvg-wasm` (aucun navigateur requis), stockée dans un bucket Storage `tweets` pour l'aperçu superadmin
4. signe la requête OAuth 1.0a, upload le média, poste le tweet, enregistre le résultat dans `tweet_posts`

Hashtags : `#labordure_lejeu` + hashtag dérivé du nom de la course (accents/espaces retirés), plus le lien `Labordure.app`.

### Points d'accroche
Appel non bloquant (fire-and-forget, erreurs seulement journalisées) à la fin de :
`admin-stage-save-step`, `admin-gc-save`, `admin-result-save-lot`, `admin-import-race-results-csv` — après le calcul des points (`compute-points`), pour que les points figurent dans l'image.

### Front
Nouvelle page `src/pages/admin/SuperAdminTweetsPage.tsx` + route et entrée de menu dans `SuperAdminPage.desktop.tsx` et `SuperAdminPage.mobile.tsx`, avec hook de lecture/relance. Aucun changement sur les écrans publics.

## Étapes

1. Migration `tweet_posts` + flag + bucket Storage
2. Edge function `tweet-race-result` (image + OAuth + publication)
3. Branchement sur les 4 fonctions de sauvegarde
4. Écran superadmin « Tweets »
5. Test de bout en bout sur une étape déjà saisie (publication manuelle depuis le superadmin d'abord)
