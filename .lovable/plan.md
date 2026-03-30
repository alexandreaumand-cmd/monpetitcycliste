

## Fix: Sidebar navigation labels are invisible

### Root cause
The `navItemsConfig` uses keys like `home`, `standings`, `teams` with `t('navigation.${key}')`, but the translation files only have these under `navigation.header.*` (e.g. `header.rankings`, `header.teams`). The `t()` calls return empty strings, so no text appears.

### Solution
Add the missing top-level keys to both `fr/navigation.json` and `en/navigation.json` to match the sidebar config keys:

**Keys to add** (at root level of the navigation namespace):
| Config key | FR label | EN label |
|---|---|---|
| home | Accueil | Home |
| standings | Classement | Rankings |
| teams | Mon Équipe | My Team |
| results | Résultats | Results |
| races | Courses | Races |
| startlist | Startlist | Startlist |
| statistics | Statistiques | Statistics |
| auctions | Enchères | Auctions |
| live | Live | Live |
| arena | Arène | Arena |
| adminLeague | Admin Ligue | League Admin |
| superAdmin | Super Admin | Super Admin |

### Files modified
- `src/i18n/locales/fr/navigation.json` — add 12 keys
- `src/i18n/locales/en/navigation.json` — add 12 keys

No code changes needed in `AppSidebar.tsx` itself — the active styling with gold background is already correct, it just needs the labels to resolve.

