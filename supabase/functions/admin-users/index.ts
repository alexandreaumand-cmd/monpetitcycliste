// Fonction regroupee (limite de 100 fonctions par projet). Appel : supabase.functions.invoke("admin-users/<action>", ...)
// Actions : create, delete, resend-confirmation, reset-password, set-role, list, toggle-ban
import { serveRouter } from "../_shared/router.ts";
import "./handlers/create.ts"; // ex-admin-user-create
import "./handlers/delete.ts"; // ex-admin-user-delete
import "./handlers/resend-confirmation.ts"; // ex-admin-user-resend-confirmation
import "./handlers/reset-password.ts"; // ex-admin-user-reset-password
import "./handlers/set-role.ts"; // ex-admin-user-set-role
import "./handlers/list.ts"; // ex-admin-users-list
import "./handlers/toggle-ban.ts"; // ex-admin-user-toggle-ban

serveRouter("admin-users");
