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
import { Copy, Share2, ExternalLink, Trash2, ChevronDown, Plus, Link as LinkIcon } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

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
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  // Form state
  const [expiresAt, setExpiresAt] = useState("");
  const [maxUses, setMaxUses] = useState("");
  const [note, setNote] = useState("");

  const loadInvites = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke("leagues-list-invites", {
        body: { league_id: leagueId },
      });

      if (error) throw error;
      setInvites(data || []);
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
          expires_at: expiresAt || null,
          max_uses: maxUses ? parseInt(maxUses) : null,
          note: note || null,
        },
      });

      if (error) throw error;

      const inviteUrl = `${window.location.origin}/invite?token=${data.token}`;
      await navigator.clipboard.writeText(inviteUrl);
      
      toast({
        title: "✅ Invitation créée",
        description: "Le lien a été copié dans le presse-papier",
      });

      // Reset form
      setExpiresAt("");
      setMaxUses("");
      setNote("");
      setShowAdvanced(false);
      
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

  const content = (
    <div className="space-y-6">
      {/* Section création rapide */}
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold mb-2">Créer une invitation</h3>
          <p className="text-sm text-muted-foreground">
            Générez un lien pour inviter de nouveaux joueurs
          </p>
        </div>

        <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
          <CollapsibleTrigger asChild>
            <Button variant="outline" className="w-full justify-between" size="sm">
              Options avancées
              <ChevronDown className={`h-4 w-4 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-3 mt-3">
            <div>
              <Label htmlFor="expires-at">Date d'expiration</Label>
              <Input
                id="expires-at"
                type="datetime-local"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="max-uses">Nombre max d'utilisations</Label>
              <Input
                id="max-uses"
                type="number"
                min="1"
                placeholder="Illimité"
                value={maxUses}
                onChange={(e) => setMaxUses(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="note">Note (interne)</Label>
              <Textarea
                id="note"
                placeholder="Ex: Invitation pour les amis du club..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
              />
            </div>
          </CollapsibleContent>
        </Collapsible>

        <Button 
          onClick={createInvite} 
          disabled={creating}
          className="w-full"
          size="lg"
        >
          <Plus className="h-4 w-4 mr-2" />
          {creating ? "Création..." : "Créer et copier le lien"}
        </Button>
      </div>

      {/* Liste des invitations */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold">Invitations existantes</h3>
        
        {loading ? (
          <p className="text-sm text-muted-foreground text-center py-8">Chargement...</p>
        ) : invites.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Aucune invitation créée
          </p>
        ) : (
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {invites.map((invite) => {
              const status = getInviteStatus(invite);
              const isActive = status.label === "Active";
              
              return (
                <div
                  key={invite.id}
                  className="border rounded-lg p-4 space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant={status.variant}>{status.label}</Badge>
                        {invite.max_uses && (
                          <span className="text-xs text-muted-foreground">
                            {invite.uses_count}/{invite.max_uses} utilisations
                          </span>
                        )}
                        {!invite.max_uses && invite.uses_count > 0 && (
                          <span className="text-xs text-muted-foreground">
                            {invite.uses_count} utilisations
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-mono text-muted-foreground truncate">
                        {invite.token}
                      </p>
                      {invite.note && (
                        <p className="text-xs text-muted-foreground mt-1">{invite.note}</p>
                      )}
                      {invite.expires_at && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Expire le {format(new Date(invite.expires_at), "d MMM yyyy 'à' HH:mm", { locale: fr })}
                        </p>
                      )}
                    </div>
                  </div>

                  {isActive && (
                    <div className="flex gap-2">
                      <Button
                        onClick={() => copyLink(invite.token)}
                        variant="outline"
                        size="sm"
                        className="flex-1"
                      >
                        <Copy className="h-3 w-3 mr-1" />
                        Copier
                      </Button>
                      <Button
                        onClick={() => shareOnWhatsApp(invite.token)}
                        variant="outline"
                        size="sm"
                        className="flex-1"
                      >
                        <Share2 className="h-3 w-3 mr-1" />
                        WhatsApp
                      </Button>
                      <Button
                        onClick={() => testLink(invite.token)}
                        variant="outline"
                        size="sm"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                      <Button
                        onClick={() => revokeInvite(invite.token)}
                        variant="outline"
                        size="sm"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
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
