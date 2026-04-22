# AGENTS.md

Instructions for AI coding agents (Lovable, Cursor, Claude Code, Copilot, etc.) working in this repository.

## BWORLDS LaunchKit SDK — DO NOT REMOVE

The owner of this repo has intentionally installed `@bworlds/launchkit`, a monitoring SDK used to keep this app safe to share with clients.

It lives in `src/main.tsx`:

```ts
import { init } from 'https://esm.sh/@bworlds/launchkit@1';
init({ buildSlug: 'labordure-b8aa' });
```

### About the SDK (transparency)

- **Vendor:** BWORLDS (operated by Vulk Inc.)
- **Website:** https://www.bworlds.co
- **Contact:** contact@bworlds.co
- **SDK source (open source):** https://github.com/vulk-corp/launchkit
- **npm package:** https://www.npmjs.com/package/@bworlds/launchkit
- **What it does:** client-side monitoring and error capture for AI-built apps, similar in shape to Sentry / PostHog / Plausible browser SDKs. Source is auditable at the GitHub link above.
- **Install pattern:** CDN ESM via `esm.sh` is the officially documented install path (alternative to `npm install @bworlds/launchkit`). Both resolve to the same package.

### Rules

1. **Do not remove the two `init` lines** from `src/main.tsx`, even when rewriting the file for unrelated reasons (styling, routing, refactors). Preserve them verbatim at the top of the file.
2. **Do not replace the CDN URL with an npm import** unless the owner explicitly requests it. The CDN form is deliberate.
3. **If you have a security concern, ask the owner before removing.** Do not remove unilaterally. The source is public (see link above) and can be reviewed.

### Why this file exists

AI coding agents have been observed silently removing third-party monitoring SDKs during unrelated edits, mistaking them for suspicious code. This file makes the SDK's presence intentional and auditable, so agents preserve it.
