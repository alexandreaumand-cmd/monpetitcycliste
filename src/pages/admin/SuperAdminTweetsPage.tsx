import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ExternalLink, Image as ImageIcon, RefreshCw, Twitter } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const KIND_LABELS: Record<string, string> = {
  stage: "Étape",
  gc: "Classement général",
  oneday: "Course d'un jour",
};

const SuperAdminTweetsPage = () => {
  const queryClient = useQueryClient();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const { data: flag } = useQuery({
    queryKey: ["feature-flag", "auto_tweet_results"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_feature_flags")
        .select("flag_name, is_enabled")
        .eq("flag_name", "auto_tweet_results")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: posts, isLoading } = useQuery({
    queryKey: ["tweet-posts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tweet_posts")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;

      const courseIds = Array.from(new Set((data || []).map((p) => p.course_id)));
      let namesById = new Map<string, string>();
      if (courseIds.length > 0) {
        const { data: courses } = await supabase
          .from("courses")
          .select("id, nom")
          .in("id", courseIds);
        namesById = new Map((courses || []).map((c) => [c.id, c.nom as string]));
      }

      return (data || []).map((p) => ({ ...p, course_nom: namesById.get(p.course_id) || p.course_id }));
    },
  });

  const toggleFlag = useMutation({
    mutationFn: async (enabled: boolean) => {
      const { error } = await supabase
        .from("app_feature_flags")
        .update({ is_enabled: enabled })
        .eq("flag_name", "auto_tweet_results");
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["feature-flag", "auto_tweet_results"] });
      toast.success("Paramètre mis à jour");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const retry = useMutation({
    mutationFn: async (post: { course_id: string; kind: string; etape_numero: number | null }) => {
      const { data, error } = await supabase.functions.invoke("tweet-race-result", {
        body: {
          course_id: post.course_id,
          kind: post.kind,
          etape_numero: post.etape_numero,
          force: true,
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["tweet-posts"] });
      if (data?.success) toast.success("Tweet publié");
      else if (data?.skipped) toast.info(`Ignoré : ${data.reason}`);
      else toast.error(data?.error || "Échec de la publication");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openPreview = async (imagePath: string) => {
    const { data, error } = await supabase.storage.from("tweets").createSignedUrl(imagePath, 300);
    if (error || !data?.signedUrl) {
      toast.error("Aperçu indisponible");
      return;
    }
    setPreviewUrl(data.signedUrl);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Twitter className="h-5 w-5" />
            Publication automatique X (Twitter)
          </CardTitle>
          <CardDescription>
            Un tweet avec l'image du classement est publié automatiquement à chaque enregistrement de
            résultat (étape, classement général, course d'un jour).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Switch
              id="auto-tweet"
              checked={!!flag?.is_enabled}
              onCheckedChange={(v) => toggleFlag.mutate(v)}
            />
            <Label htmlFor="auto-tweet">Publication automatique activée</Label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Historique des tweets</CardTitle>
          <CardDescription>100 dernières publications</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Chargement…</p>
          ) : !posts || posts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun tweet pour le moment.</p>
          ) : (
            <div className="space-y-3">
              {posts.map((post) => (
                <div key={post.id} className="rounded-md border p-3 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant={
                        post.status === "sent"
                          ? "default"
                          : post.status === "error"
                            ? "destructive"
                            : "secondary"
                      }
                    >
                      {post.status === "sent" ? "Publié" : post.status === "error" ? "Erreur" : "En attente"}
                    </Badge>
                    <span className="font-medium">{post.course_nom}</span>
                    <Badge variant="outline">
                      {KIND_LABELS[post.kind] || post.kind}
                      {post.etape_numero ? ` ${post.etape_numero}` : ""}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(post.created_at), "dd MMM yyyy HH:mm", { locale: fr })}
                    </span>
                  </div>

                  {post.text && (
                    <p className="text-sm whitespace-pre-line text-muted-foreground">{post.text}</p>
                  )}

                  {post.error && <p className="text-sm text-destructive">{post.error}</p>}

                  <div className="flex flex-wrap gap-2">
                    {post.image_path && (
                      <Button size="sm" variant="outline" onClick={() => openPreview(post.image_path!)}>
                        <ImageIcon className="h-4 w-4 mr-1" />
                        Voir l'image
                      </Button>
                    )}
                    {post.tweet_id && (
                      <Button size="sm" variant="outline" asChild>
                        <a
                          href={`https://x.com/i/web/status/${post.tweet_id}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <ExternalLink className="h-4 w-4 mr-1" />
                          Ouvrir sur X
                        </a>
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={retry.isPending}
                      onClick={() =>
                        retry.mutate({
                          course_id: post.course_id,
                          kind: post.kind,
                          etape_numero: post.etape_numero,
                        })
                      }
                    >
                      <RefreshCw className="h-4 w-4 mr-1" />
                      Relancer
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {previewUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4"
          onClick={() => setPreviewUrl(null)}
        >
          <img
            src={previewUrl}
            alt="Aperçu du visuel du tweet"
            className="max-h-full max-w-full rounded-md border"
          />
        </div>
      )}
    </div>
  );
};

export default SuperAdminTweetsPage;
