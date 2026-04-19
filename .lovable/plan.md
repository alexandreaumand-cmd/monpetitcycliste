

## Investigation supplémentaire nécessaire

L'utilisateur indique que les récaps fonctionnaient avant le 15 mars. Je dois vérifier l'historique de la fonction `arena-recaps` et confirmer/affiner mon diagnostic précédent.

Je vais inspecter le code actuel de `arena-recaps/index.ts` pour confirmer que :
1. La fonction n'utilise PAS déjà `EdgeRuntime.waitUntil()` 
2. Il n'y a pas un autre problème introduit récemment (régression code) qui expliquerait que ça marchait avant le 15 mars
3. Vérifier l'historique des modifications via les logs Postgres / runs

# Plan de validation et correction des récaps Arena

## Hypothèse révisée

L'info "ça marchait avant le 15 mars" change l'analyse. Deux scénarios possibles :

**Scénario A — Régression code (le plus probable)** : Une modification de la fonction `arena-recaps` après le 15 mars a introduit :
- Un cold-start plus long (nouvel import lourd, nouvelle dépendance)
- Un traitement synchrone plus lourd (boucle agrandie, requêtes ajoutées)
- Un bug bloquant au boot (erreur d'import, variable manquante)

**Scénario B — Évolution infra `pg_net`** : Le timeout HTTP de `pg_net` était plus permissif avant et a été durci côté Supabase.

Le scénario A est le plus probable car les logs edge sont **totalement vides** (pas même un "booted") → la fonction ne démarre pas du tout, ce qui pointe vers un crash au boot ou un bundle invalide, pas vers un simple dépassement de timeout.

## Vérifications à mener (en mode default)

1. **Lire `supabase/functions/arena-recaps/index.ts`** intégralement pour repérer :
   - Imports problématiques (esm.sh instable vs npm:)
   - Présence éventuelle déjà de `EdgeRuntime.waitUntil`
   - Volume de traitement synchrone

2. **Tester un appel direct** via `curl_edge_functions` pour observer la vraie réponse (200/500/timeout) et savoir si la fonction boot.

3. **Inspecter `cron.job_run_details`** filtré sur les runs avant le 15 mars pour confirmer qu'ils étaient bien "succeeded" avec une durée < 5s à l'époque.

4. **Inspecter les logs edge `arena-recaps`** sur 30 jours (pas seulement récents) pour voir si la fonction a déjà bootée.

## Plan de correction (combiné, robuste aux deux scénarios)

### Étape 1 — Diagnostic in-situ
- Tester `curl_edge_functions` sur `arena-recaps` avec `{type:'daily', date:'2026-04-19'}` → mesurer temps de réponse et code HTTP réel.
- Si **erreur 500/boot crash** → corriger le bundle (imports `npm:` au lieu de `esm.sh`, supprimer `deno.lock` si nécessaire — cf. mémoire `technical/edge-functions/bundling-stability`).
- Si **timeout 5s côté pg_net mais 200 OK côté direct** → bascule asynchrone obligatoire.

### Étape 2 — Refactor asynchrone (filet de sécurité dans tous les cas)
Modifier `arena-recaps/index.ts` :
```typescript
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const body = await req.json().catch(() => ({}));
  // Insérer immédiatement la ligne arena_recap_runs en status 'pending'
  EdgeRuntime.waitUntil(processRecaps(body));
  return new Response(JSON.stringify({ ok: true, queued: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
```

### Étape 3 — Stabiliser le bundle
- Remplacer `https://esm.sh/@supabase/supabase-js@2` par `npm:@supabase/supabase-js@2` (cf. mémoire bundling-stability).
- Supprimer `supabase/functions/arena-recaps/deno.lock` si présent (cf. troubleshooting deploy).

### Étape 4 — Redéploiement explicite + test
- `deploy_edge_functions(["arena-recaps"])`
- `curl_edge_functions` pour valider réponse < 1s.

### Étape 5 — Récupération manuelle
- Déclencher `arena-recaps` `{type:'daily', date:'2026-04-19'}`
- Déclencher `arena-recaps` `{type:'weekly', date:'2026-04-13'}` (dimanche dernier)
- Vérifier l'apparition de lignes dans `arena_recap_runs`.

## Fichiers modifiés
1. `supabase/functions/arena-recaps/index.ts` — bascule async + imports `npm:`
2. Suppression éventuelle de `supabase/functions/arena-recaps/deno.lock`
3. Re-déploiement + appels manuels de récupération

## Hors scope
- Pas de modif du cron, ni du watchdog, ni de `arena_recap_runs`.

