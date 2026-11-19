# CLAUDE.md — La Bordure

App de fantasy cyclisme (labordure.app). Construite avec Lovable, backend Lovable Cloud (Supabase) en cours de migration vers un projet Supabase personnel. Voir `MIGRATION.md`.

## Stack
- Front : React 18 + Vite + TypeScript, Tailwind + shadcn/ui (Radix), TanStack Query, i18next, framer-motion.
- Backend : Supabase (Postgres, Auth, Storage, Realtime, Edge Functions Deno dans `supabase/functions`, 124 fonctions + `_shared`).
- Fonctions regroupées (limite de 100 par projet) : `admin-users`, `exports`, `auction-get`, `league-invites`. Chaque action est dans `supabase/functions/<groupe>/handlers/<action>.ts`, aiguillée par `_shared/router.ts`, et appelée par `supabase.functions.invoke("<groupe>/<action>")`. Une nouvelle fonction d'admin ou d'export doit devenir une action d'un groupe. Ne jamais lancer `supabase functions deploy` sans nom de fonction (106 dossiers > 100).
- Migrations SQL : `supabase/migrations` (~600 fichiers, générés par Lovable).
- `drizzle/` + `drizzle.config.ts` : schéma Drizzle annexe (lit `LOVABLE_DB_MIGRATION_URL`), pas utilisé par le build.
- Lovable : `@lovable.dev/cloud-auth-js` (Google/Apple sign-in, `src/integrations/lovable`), `@lovable.dev/email-js` et `@lovable.dev/webhooks-js` (edge functions email).
- Monitoring : `@bworlds/launchkit` chargé dans `src/main.tsx` (voir `AGENTS.md`, ne pas retirer).

## Commandes
- `npm install` — dépendances (lockfiles npm et bun présents)
- `npm run dev` — serveur Vite
- `npm run build` — build de prod
- `npm run lint` — ESLint
- `npm run prepublish-check` — rapport + build
- Supabase CLI : `npx supabase …` (pas d'installation globale)

## Config Supabase
- `.env` : `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`.
- `supabase/config.toml` : `project_id` + `verify_jwt` par fonction.

## Règles pendant la migration (phase 1)
- Ne pas toucher à la prod, au domaine, au DNS ; pas de déploiement Vercel ; l'app tourne sur Lovable.
- Ne pas pousser sur `main` (la sync GitHub de Lovable l'appliquerait en prod). Travail sur `migration/supabase-phase1`.
- Jamais de `.backup`, `.env`, données ou secrets dans un commit.
- Ne pas rejouer `supabase/migrations` (`db push`) sur le projet restauré depuis le backup.
- Pas d'INSERT manuel dans `auth.users` / `auth.identities`.
