import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MobileBottomSheet } from "@/components/mobile/MobileBottomSheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { Share2, Users } from "lucide-react";
import { useLeagueMembers } from "@/hooks/useLeagueMembers";

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
  maxPlayers: number;
  currentPlayerCount: number;
}

export function LeagueInvitesBottomSheet({ 
  open, 
  onOpenChange, 
  leagueId, 
  leagueName,
  maxPlayers,
  currentPlayerCount
}: LeagueInvitesBottomSheetProps) {
  const isMobile = useIsMobile();
  const { toast } = useToast();
  
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);

  // Load members
  const { data: members = [], isLoading: loadingMembers } = useLeagueMembers(leagueId);

  const loadInvites = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke("leagues-list-invites", {
        body: { league_id: leagueId },
      });

      if (error) throw error;
      setInvites(data?.invites || []);
    } catch (error: any) {
      console.error("Error loading invites:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      loadInvites();
    }
  }, [open, leagueId]);

  const getInviteStatus = (invite: Invite) => {
    if (invite.is_revoked) return { label: "Révoquée" };
    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      return { label: "Expirée" };
    }
    if (invite.max_uses && invite.uses_count >= invite.max_uses) {
      return { label: "Complète" };
    }
    return { label: "Active" };
  };

  const activeInvites = invites.filter(i => getInviteStatus(i).label === "Active");
  const remainingSpots = maxPlayers - currentPlayerCount;

  const handleShareWhatsApp = async () => {
    try {
      setSharing(true);

      // Get or create invite token
      let token = activeInvites[0]?.token;
      
      if (!token) {
        const { data, error } = await supabase.functions.invoke("leagues-create-invite", {
          body: {
            league_id: leagueId,
            expires_at: null,
            max_uses: null,
            note: null,
          },
        });

        if (error) throw error;
        token = data.token;
        await loadInvites();
      }
      
      const inviteUrl = `${window.location.origin}/invite?token=${token}`;
      const message = encodeURIComponent(
        `Rejoins la ligue "${leagueName}" sur Fantasy Cycling !\n\n${inviteUrl}\n\nPlaces restantes : ${remainingSpots}`
      );
      window.open(`https://wa.me/?text=${message}`, '_blank');
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de partager l'invitation",
        variant: "destructive",
      });
    } finally {
      setSharing(false);
    }
  };

  const content = (
    <div className="space-y-6">
      {/* Section: Membres actuels */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Membres de la ligue</h3>
        </div>
        <div className="bg-muted/50 rounded-lg p-4">
          {loadingMembers ? (
            <p className="text-sm text-muted-foreground text-center">Chargement...</p>
          ) : members.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center">
              Aucun membre pour le moment
            </p>
          ) : (
            <ul className="space-y-2">
              {members.map((member) => (
                <li key={member.id} className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  <span className="text-sm">{member.name}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Section: Places restantes */}
      <div className="bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-950/20 dark:to-orange-950/20 rounded-lg p-4 border border-yellow-200 dark:border-yellow-800">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Places restantes</span>
          <span className="text-2xl font-bold text-primary">
            {remainingSpots}
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {currentPlayerCount} / {maxPlayers} joueurs
        </p>
      </div>

      {/* Section: Partage WhatsApp */}
      <Button 
        onClick={handleShareWhatsApp}
        disabled={sharing}
        size="lg"
        className="w-full h-14 text-base bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-500 hover:to-orange-600 text-white shadow-lg"
      >
        <Share2 className="h-5 w-5 mr-2" />
        {sharing ? "Chargement..." : "Partager via WhatsApp"}
      </Button>
    </div>
  );

  if (isMobile) {
    return (
      <MobileBottomSheet
        open={open}
        onOpenChange={onOpenChange}
        title="Inviter des joueurs"
        description={`${leagueName}`}
      >
        {content}
      </MobileBottomSheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Inviter des joueurs</DialogTitle>
          <DialogDescription>{leagueName}</DialogDescription>
        </DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
  );
}
