import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MobileBottomSheet } from "@/components/mobile/MobileBottomSheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { Copy, Share2, ExternalLink, Trash2, MoreVertical, Sparkles, Users, Calendar } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Invite {
  id: string;
  token: string;
  expires_at: string | null;
  max_uses: number | null;
  uses_count: number;
  note: string | null;
  is_revoked: boolean;
  created_at: string;
}

interface LeagueInvitesBottomSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leagueId: string;
  leagueName: string;
}

export function LeagueInvitesBottomSheet({ 
  open, 
  onOpenChange, 
  leagueId, 
  leagueName 
}: LeagueInvitesBottomSheetProps) {
  const isMobile = useIsMobile();
  const { toast } = useToast();
  
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const loadInvites = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke("leagues-list-invites", {
        body: { league_id: leagueId },
      });

      if (error) throw error;
      setInvites(data?.invites || []);
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de charger les invitations",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      loadInvites();
    }
  }, [open, leagueId]);

  const createInvite = async () => {
    try {
      setCreating(true);
      const { data, error } = await supabase.functions.invoke("leagues-create-invite", {
        body: {
          league_id: leagueId,
          expires_at: null,
          max_uses: null,
          note: null,
        },
      });

      if (error) throw error;

      const inviteUrl = `${window.location.origin}/invite?token=${data.token}`;
      await navigator.clipboard.writeText(inviteUrl);
      
      toast({
        title: "✅ Lien copié !",
        description: "Partagez-le avec vos amis pour qu'ils rejoignent la ligue",
      });
      
      // Reload invites
      await loadInvites();
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de créer l'invitation",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const copyLink = async (token: string) => {
    const inviteUrl = `${window.location.origin}/invite?token=${token}`;
    await navigator.clipboard.writeText(inviteUrl);
    toast({
      title: "✅ Lien copié",
      description: "Le lien d'invitation a été copié",
    });
  };

  const shareOnWhatsApp = (token: string) => {
    const inviteUrl = `${window.location.origin}/invite?token=${token}`;
    const message = encodeURIComponent(
      `Rejoins la ligue "${leagueName}" sur Fantasy Cycling !\n${inviteUrl}`
    );
    window.open(`https://wa.me/?text=${message}`, '_blank');
  };

  const testLink = (token: string) => {
    const inviteUrl = `${window.location.origin}/invite?token=${token}`;
    window.open(inviteUrl, '_blank');
  };

  const revokeInvite = async (token: string) => {
    if (!confirm("Voulez-vous vraiment révoquer cette invitation ?")) return;

    try {
      const { error } = await supabase.functions.invoke("leagues-revoke-invite", {
        body: { league_id: leagueId, token },
      });

      if (error) throw error;

      toast({
        title: "✅ Invitation révoquée",
        description: "L'invitation a été révoquée avec succès",
      });

      await loadInvites();
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de révoquer l'invitation",
        variant: "destructive",
      });
    }
  };

  const getInviteStatus = (invite: Invite) => {
    if (invite.is_revoked) return { label: "Révoquée", variant: "destructive" as const };
    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      return { label: "Expirée", variant: "secondary" as const };
    }
    if (invite.max_uses && invite.uses_count >= invite.max_uses) {
      return { label: "Complète", variant: "secondary" as const };
    }
    return { label: "Active", variant: "default" as const };
  };

  const activeInvites = invites.filter(i => getInviteStatus(i).label === "Active");

  const content = (
    <div className="space-y-8">
      {/* Empty state / CTA */}
      {invites.length === 0 && !loading && (
        <div className="text-center py-12 space-y-6">
          <div className="flex justify-center">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-yellow-400/20 to-orange-500/20 flex items-center justify-center">
              <Sparkles className="h-10 w-10 text-yellow-600" />
            </div>
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-semibold">Invitez vos amis !</h3>
            <p className="text-muted-foreground max-w-sm mx-auto">
              Créez votre premier lien d'invitation en un clic et partagez-le
            </p>
          </div>
        </div>
      )}

      {/* Main CTA Button */}
      <div className="flex justify-center">
        <Button 
          onClick={createInvite} 
          disabled={creating}
          size="lg"
          className="h-14 px-8 text-base bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-500 hover:to-orange-600 text-white shadow-lg hover:shadow-xl transition-all"
        >
          <Sparkles className="h-5 w-5 mr-2" />
          {creating ? "Création..." : "Créer un lien d'invitation"}
        </Button>
      </div>

      {/* Active invitations list */}
      {activeInvites.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-muted-foreground">
              Invitations actives ({activeInvites.length})
            </h3>
          </div>
          
          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {activeInvites.map((invite) => {
              const peopleCount = invite.uses_count;
              const timeAgo = formatDistanceToNow(new Date(invite.created_at), { 
                addSuffix: true, 
                locale: fr 
              });
              
              return (
                <div
                  key={invite.id}
                  className="border-l-4 border-green-500 bg-card rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2 text-sm">
                      <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                      <span className="font-medium">
                        {peopleCount === 0 ? "Aucun membre" : peopleCount === 1 ? "1 personne a rejoint" : `${peopleCount} personnes ont rejoint`}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <Button
                      onClick={() => copyLink(invite.token)}
                      variant="outline"
                      size="sm"
                      className="h-10"
                    >
                      <Copy className="h-4 w-4 mr-2" />
                      Copier
                    </Button>
                    <Button
                      onClick={() => shareOnWhatsApp(invite.token)}
                      variant="outline"
                      size="sm"
                      className="h-10"
                    >
                      <Share2 className="h-4 w-4 mr-2" />
                      WhatsApp
                    </Button>
                  </div>

                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      <span>Créée {timeAgo}</span>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => testLink(invite.token)}>
                          <ExternalLink className="h-4 w-4 mr-2" />
                          Tester le lien
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => revokeInvite(invite.token)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Révoquer
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="text-center py-8">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent" />
        </div>
      )}
    </div>
  );

  if (isMobile) {
    return (
      <MobileBottomSheet
        open={open}
        onOpenChange={onOpenChange}
        title="Gérer les invitations"
        description={`Ligue : ${leagueName}`}
        className="h-[85vh]"
      >
        {content}
      </MobileBottomSheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Gérer les invitations</DialogTitle>
          <DialogDescription>Ligue : {leagueName}</DialogDescription>
        </DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
  );
}
