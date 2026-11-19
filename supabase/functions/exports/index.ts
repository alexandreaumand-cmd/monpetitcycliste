// Fonction regroupee (limite de 100 fonctions par projet). Appel : supabase.functions.invoke("exports/<action>", ...)
// Actions : all-tables, baremes-csv, coureurs-csv, courses-csv, resultats-csv, rosters-csv
import { serveRouter } from "../_shared/router.ts";
import "./handlers/all-tables.ts"; // ex-export-all-tables
import "./handlers/baremes-csv.ts"; // ex-export-baremes-csv
import "./handlers/coureurs-csv.ts"; // ex-export-coureurs-csv
import "./handlers/courses-csv.ts"; // ex-export-courses-csv
import "./handlers/resultats-csv.ts"; // ex-export-resultats-csv
import "./handlers/rosters-csv.ts"; // ex-export-rosters-csv

serveRouter("exports");
