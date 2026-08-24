# Corriger le scraping des startlists (erreur 403 PCS)

## L'erreur exacte

Les logs de la fonction `startlist-tracker` montrent, pour chaque course traitée :

```text
Failed to fetch race page: 403 for https://www.procyclingstats.com/race/gp-montreal/2026/startlist
Failed to fetch race page: 403 for https://www.procyclingstats.com/race/bretagne-classic/2026/startlist
Failed to fetch race page: 403 for https://www.procyclingstats.com/race/gp-de-fourmies/2026/startlist
```

Ce n'est donc pas un problème de slug ni de code de parsing : ProCyclingStats refuse la requête (403 = accès interdit). Le message "Edge Function returned a non-2xx status code" affiché dans l'écran vient de là.

## La cause

Nos appels envoient uniquement un en-tête `User-Agent` "Chrome/120". PCS a durci son filtrage anti-robot et rejette désormais ce type de requête trop pauvre en en-têtes.

Vérification faite à l'instant sur la même URL :
- requête avec seulement le `User-Agent` Chrome/120 → **403**
- requête avec des en-têtes de navigateur complets (`User-Agent` récent, `Accept`, `Accept-Language`, `Referer`) → **200**

Tous les scrapers PCS du projet utilisent le même en-tête minimal, ils sont donc tous exposés au même blocage (startlists, résultats, live, abandons, blessures).

## Correction proposée

1. Créer un utilitaire partagé de récupération de pages PCS (dans `supabase/functions/_shared/`) qui envoie un jeu d'en-têtes de navigateur complet et réaliste : `User-Agent` récent, `Accept`, `Accept-Language`, `Referer` sur `procyclingstats.com`, `Accept-Encoding`, `Upgrade-Insecure-Requests`.
2. Ajouter dans cet utilitaire une politique de reprise : en cas de 403/429/5xx, jusqu'à 3 tentatives avec attente croissante et rotation entre 2-3 profils de navigateur, avant de remonter une erreur claire.
3. Brancher cet utilitaire sur tous les appels PCS existants : `startlist-tracker` (page course + PDF startlist), `scrape-pcs-results`, `scrape-live-race`, `scrape-startlist-abandons`, `scrape-rider-injuries`.
4. Améliorer le message d'erreur remonté à l'écran super-admin : afficher "PCS a refusé la requête (403) après N tentatives" au lieu de "Edge Function returned a non-2xx status code".
5. Vérifier après déploiement en relançant un scraping sur `gp-montreal/2026` et une synchro globale, puis contrôler les logs.

## Détails techniques

- Nouveau fichier `supabase/functions/_shared/pcsFetch.ts` exportant `fetchPcs(url, init?)` : en-têtes complets, retry exponentiel (500 ms / 1,5 s / 3,5 s), rotation d'`User-Agent`, erreur typée `PcsFetchError` portant le statut HTTP et l'URL.
- `startlist-tracker/index.ts` : remplacer les deux `fetch` (page course ligne ~1251, PDF ligne ~1152) par `fetchPcs`, en conservant le `Referer` spécifique du PDF.
- Idem pour les quatre autres fonctions de scraping, en gardant leur gestion d'erreur actuelle mais en propageant le statut PCS réel dans la réponse JSON.
- Si PCS bloque encore malgré les en-têtes complets (IP datacenter mise en liste noire), la solution de repli sera de passer par le connecteur Firecrawl pour récupérer le HTML ; à décider seulement si les tests post-déploiement montrent encore des 403.
