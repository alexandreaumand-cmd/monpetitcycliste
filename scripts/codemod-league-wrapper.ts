/**
 * Codemod : remplace supabase par useLeagueClient() côté client ("use client"),
 * et ajoute TODO côté serveur (edge functions).
 *
 * Usage: npx ts-node scripts/codemod-league-wrapper.ts
 */
import { Project, SyntaxKind } from "ts-morph";
import path from "node:path";

const ROOT = process.cwd();
const SRC = path.join(ROOT, "src");

const project = new Project({
  tsConfigFilePath: path.join(ROOT, "tsconfig.json"),
  skipAddingFilesFromTsConfig: false,
});

project.addSourceFilesAtPaths([
  path.join(SRC, "**/*.ts"),
  path.join(SRC, "**/*.tsx"),
]);

const CLIENT_IMPORT = "@/integrations/supabase/client";
const WRAPPER_IMPORT = "@/lib/supabase/leagueClient";

let changed = 0;

for (const sf of project.getSourceFiles()) {
  const filePath = sf.getFilePath();

  // Ignore d.ts and generated files
  if (filePath.endsWith(".d.ts") || filePath.includes("integrations/supabase")) continue;

  const text = sf.getFullText();
  const isClientFile = text.startsWith('"use client"') || text.startsWith("'use client'");

  // Remplacer import supabase côté client
  if (isClientFile) {
    const imp = sf.getImportDeclaration(i => i.getModuleSpecifierValue() === CLIENT_IMPORT);
    if (imp) {
      // Ajouter import useLeagueClient
      let wrapperImp = sf.getImportDeclaration(i => i.getModuleSpecifierValue() === WRAPPER_IMPORT);
      if (!wrapperImp) {
        sf.addImportDeclaration({
          moduleSpecifier: WRAPPER_IMPORT,
          namedImports: [{ name: "useLeagueClient" }],
        });
      } else if (!wrapperImp.getNamedImports().some(n => n.getName() === "useLeagueClient")) {
        wrapperImp.addNamedImport("useLeagueClient");
      }

      // Trouver toutes les fonctions qui utilisent supabase
      const functions = sf.getFunctions().concat(
        sf.getDescendantsOfKind(SyntaxKind.ArrowFunction),
        sf.getDescendantsOfKind(SyntaxKind.FunctionExpression)
      );

      for (const func of functions) {
        const body = func.getBody();
        if (body && body.getKind() === SyntaxKind.Block) {
          const bodyText = body.getText();
          if (bodyText.includes("supabase.") && !bodyText.includes("useLeagueClient()")) {
            // Ajouter const supabase = useLeagueClient() au début de la fonction
            (body as any).insertStatements(0, "const supabase = useLeagueClient();");
            changed++;
          }
        }
      }
    }
  }
}

// Ajouter TODO pour les edge functions
const FUNCTIONS_DIR = path.join(ROOT, "supabase", "functions");
project.addSourceFilesAtPaths([
  path.join(FUNCTIONS_DIR, "**/*.ts"),
]);

for (const sf of project.getSourceFiles()) {
  const filePath = sf.getFilePath();
  if (!filePath.includes("supabase/functions") || filePath.includes("_shared")) continue;

  const text = sf.getFullText();
  if (text.includes("createClient") && !text.includes("TODO: Remplacer")) {
    sf.insertText(0,
`/* TODO: Remplacer createClient() par createLeagueServiceClient(leagueId, baseClient)
   - Récupérer leagueId depuis req.body
   - Valider via isUuid()
   - const supabase = createLeagueServiceClient(leagueId, baseClient)
   
   Example:
   import { isUuid } from '../../src/lib/leagues/validate.ts';
   import { createLeagueServiceClient } from '../../src/lib/supabase/leagueClient.ts';
   
   const { league_id } = await req.json();
   if (!isUuid(league_id)) {
     return new Response(JSON.stringify({ error: 'league_id required' }), {
       status: 400,
       headers: { ...corsHeaders, 'Content-Type': 'application/json' }
     });
   }
   
   const baseClient = createClient(...);
   const supabase = createLeagueServiceClient(league_id, baseClient);
*/\n\n`);
    changed++;
  }
}

if (changed > 0) {
  project.saveSync();
  console.log(`✅ Codemod appliqué : ${changed} fichier(s) modifié(s).`);
} else {
  console.log("ℹ️ Aucune modification nécessaire.");
}
