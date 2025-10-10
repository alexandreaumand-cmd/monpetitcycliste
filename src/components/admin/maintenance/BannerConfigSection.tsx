import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Megaphone, Save, RefreshCw } from "lucide-react";

export const BannerConfigSection = () => {
  const [bannerMessage, setBannerMessage] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: banner, refetch: refetchBanner } = useQuery({
    queryKey: ['announcement-banner'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('announcement_banner')
        .select('*')
        .single();
      
      if (error) throw error;
      return data as { id: string; is_active: boolean; message: string };
    },
  });

  useEffect(() => {
    if (banner?.message) {
      setBannerMessage(banner.message);
    }
  }, [banner?.message]);

  const updateBannerMutation = useMutation({
    mutationFn: async (updates: { is_active?: boolean; message?: string }) => {
      const { data: manager } = await supabase
        .from('managers')
        .select('id')
        .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
        .single();

      const { error } = await supabase
        .from('announcement_banner')
        .update({ ...updates, updated_by: manager?.id, updated_at: new Date().toISOString() })
        .eq('id', banner?.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Bandeau mis à jour",
        description: "Les modifications ont été enregistrées.",
      });
      refetchBanner();
      queryClient.invalidateQueries({ queryKey: ['announcement-banner'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Megaphone className="h-5 w-5" />
          Bandeau d'annonce
        </CardTitle>
        <CardDescription>
          Gérer le bandeau d'annonce affiché en haut de toutes les pages
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {banner && (
          <>
            <div className="flex items-center justify-between">
              <Label htmlFor="banner-active">Activer le bandeau</Label>
              <Switch
                id="banner-active"
                checked={banner.is_active}
                onCheckedChange={(checked) => updateBannerMutation.mutate({ is_active: checked })}
                disabled={updateBannerMutation.isPending}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="banner-message">Message</Label>
              <Textarea
                id="banner-message"
                value={bannerMessage}
                onChange={(e) => setBannerMessage(e.target.value)}
                disabled={updateBannerMutation.isPending}
                className="min-h-[80px]"
                placeholder="En hommage à Guillaume Di Grazia - 1973-2025 🙏"
              />
              <Button
                onClick={() => updateBannerMutation.mutate({ message: bannerMessage })}
                disabled={updateBannerMutation.isPending || bannerMessage === banner.message}
                className="w-full"
              >
                {updateBannerMutation.isPending ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Sauvegarde en cours...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Sauvegarder le message
                  </>
                )}
              </Button>
              <p className="text-sm text-muted-foreground">
                Le message sera affiché en haut de toutes les pages quand le bandeau est activé
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};
