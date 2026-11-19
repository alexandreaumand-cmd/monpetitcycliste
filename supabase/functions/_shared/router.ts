// Regroupement de plusieurs edge functions en une seule (limite de 100 fonctions par projet
// sur le forfait gratuit). Chaque ancienne fonction devient une « action » appelée par sous-chemin :
//   supabase.functions.invoke("admin-users/create", { body })  →  /functions/v1/admin-users/create
// Le code de chaque action est celui de l'ancienne fonction, inchangé : seul son
// `serve(handler)` est remplacé par `registerHandler("<action>", handler)`.

type Handler = (req: Request) => Response | Promise<Response>;

const handlers = new Map<string, Handler>();

export function registerHandler(action: string, handler: Handler): void {
  if (handlers.has(action)) throw new Error(`Action déjà enregistrée : ${action}`);
  handlers.set(action, handler);
}

const fallbackCors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// L'action est le segment qui suit le nom de la fonction dans le chemin
// (fonctionne que le runtime fournisse "/admin-users/create" ou "/functions/v1/admin-users/create").
export function actionFromUrl(functionName: string, url: string): string | undefined {
  const parts = new URL(url).pathname.split("/").filter(Boolean);
  const i = parts.lastIndexOf(functionName);
  return i >= 0 ? parts[i + 1] : undefined;
}

export function serveRouter(functionName: string): void {
  Deno.serve(async (req) => {
    const action = actionFromUrl(functionName, req.url);
    const handler = action ? handlers.get(action) : undefined;
    if (handler) return await handler(req); // OPTIONS compris : géré par l'action, comme avant
    if (req.method === "OPTIONS") return new Response("ok", { headers: fallbackCors });
    return new Response(
      JSON.stringify({
        error: `Action inconnue « ${action ?? ""} » pour ${functionName}`,
        actions: [...handlers.keys()],
      }),
      { status: 404, headers: { ...fallbackCors, "Content-Type": "application/json" } },
    );
  });
}
