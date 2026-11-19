// Fonction regroupee (limite de 100 fonctions par projet). Appel : supabase.functions.invoke("auction-get/<action>", ...)
// Actions : context, live-status, managers-status, teams, validation-status
import { serveRouter } from "../_shared/router.ts";
import "./handlers/context.ts"; // ex-auction-get-context
import "./handlers/live-status.ts"; // ex-auction-get-live-status
import "./handlers/managers-status.ts"; // ex-auction-get-managers-status
import "./handlers/teams.ts"; // ex-auction-get-teams
import "./handlers/validation-status.ts"; // ex-auction-get-validation-status

serveRouter("auction-get");
