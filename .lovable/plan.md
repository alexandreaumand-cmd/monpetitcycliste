## Fix: Add auth check to `send-push-notification`

The function is unauthenticated and accepts `broadcast: true`, letting anyone push to all users.

### Callers (must keep working)
- **Server-to-server (edge functions)**: `_shared/notifications.ts`, `admin-import-race-results-csv`, `admin-result-save-lot`, `arena-pronostic-reminder`, `arena-recaps` — all call with `Authorization: Bearer <SERVICE_ROLE_KEY>`.
- **Frontend**: `StartlistDetailView.tsx` — superadmin-only UI invoking `supabase.functions.invoke('send-push-notification', { broadcast: true, ... })`, which forwards the logged-in user's JWT.

### Changes

**`supabase/functions/send-push-notification/index.ts`** — at the top of the handler, after CORS:

1. Require `Authorization: Bearer ...` header (401 otherwise).
2. Accept the call if the bearer token equals `SUPABASE_SERVICE_ROLE_KEY` (internal edge function calls).
3. Otherwise treat it as a user JWT: build a user-scoped client with the anon key + auth header, call `auth.getClaims(token)`, then call the `is_superadmin` RPC. Reject with 401/403 if not a verified superadmin.
4. Keep the rest of the logic unchanged (it already uses the service-role client internally for DB + sending).

**Security finding**
- Mark `push_notif_no_auth` as fixed once the function is updated.

### Frontend
No changes needed — `StartlistDetailView` already runs only for superadmins and uses `supabase.functions.invoke`, which sends the user's JWT.

### Out of scope
The other open security findings (arena recaps weak auth, arena recap watchdog, startlist tracker SSRF, pronostic reminder, realtime, RLS issues, etc.) are not addressed here.
