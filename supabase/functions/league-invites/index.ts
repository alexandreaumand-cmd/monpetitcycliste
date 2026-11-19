// Fonction regroupee (limite de 100 fonctions par projet). Appel : supabase.functions.invoke("league-invites/<action>", ...)
// Actions : create, list, revoke, info
import { serveRouter } from "../_shared/router.ts";
import "./handlers/create.ts"; // ex-leagues-create-invite
import "./handlers/list.ts"; // ex-leagues-list-invites
import "./handlers/revoke.ts"; // ex-leagues-revoke-invite
import "./handlers/info.ts"; // ex-leagues-get-invite-info

serveRouter("league-invites");
