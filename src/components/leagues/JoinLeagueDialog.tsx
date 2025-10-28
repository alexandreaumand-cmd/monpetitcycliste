import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useLeague } from "@/contexts/LeagueContext";
import { useUserLeagues } from "@/hooks/useUserLeagues";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Globe, Lock } from "lucide-react";
import type { League } from "@/lib/leagues/types";

type JoinLeagueDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function JoinLeagueDialog({ open, onOpenChange }: JoinLeagueDialogProps) {
  const navigate = useNavigate();
  const { setLeagueId } = useLeague();
  const { leagues: myLeagues, refetch } = useUserLeagues();
  const [joiningLeagueId, setJoiningLeagueId] = useState<string | null>(null);
  const [inviteCode, setInviteCode] = useState('');
  const [isJoiningByCode, setIsJoiningByCode] = useState(false);

  const { data: publicLeagues, isLoading } = useQuery({
    queryKey: ['public-leagues'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leagues')
        .select('*')
        .eq('visibility', 'public')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Filter out leagues where user is already a member
      const myLeagueIds = new Set(myLeagues.map(l => l.id));
      return (data || []).filter((league: any) => !myLeagueIds.has(league.id));
    },
    enabled: open,
  });

  const handleJoinLeague = async (leagueId: string) => {
    try {
      setJoiningLeagueId(leagueId);

      const { data, error } = await supabase.functions.invoke('leagues-join', {
        body: { league_id: leagueId },
      });

      if (error) throw error;

      toast.success("Vous avez rejoint la ligue !");
      
      // Refresh leagues list
      await refetch();
      
      // Switch to new league
      setLeagueId(leagueId);
      
      // Redirect to auctions page
      navigate(`/dashboard/encheres?leagueId=${leagueId}`);
      
      // Close dialog
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error joining league:', error);
      toast.error(error.message || "Erreur lors de la tentative de rejoindre la ligue");
    } finally {
      setJoiningLeagueId(null);
    }
  };

  const handleJoinByCode = async () => {
    if (!inviteCode.trim()) {
      toast.error("Veuillez entrer un code d'invitation");
      return;
    }
    
    try {
      setIsJoiningByCode(true);
      
      const { data, error } = await supabase.functions.invoke('leagues-join-by-token', {
        body: { token: inviteCode.trim() },
      });
      
      if (error) throw error;
      
      toast.success(`Vous avez rejoint la ligue "${data.league_name}" !`);
      
      // Refresh leagues list
      await refetch();
      
      // Switch to new league
      setLeagueId(data.league_id);
      
      // Redirect to auctions page
      navigate(`/dashboard/encheres?leagueId=${data.league_id}`);
      
      // Reset form and close dialog
      setInviteCode('');
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error joining by code:', error);
      
      // Messages d'erreur spécifiques selon le code erreur
      if (error.message?.includes('Invalid token')) {
        toast.error("Code d'invitation invalide");
      } else if (error.message?.includes('revoked')) {
        toast.error("Ce code d'invitation a été révoqué");
      } else if (error.message?.includes('expired')) {
        toast.error("Ce code d'invitation a expiré");
      } else if (error.message?.includes('limit reached')) {
        toast.error("Ce code d'invitation a atteint sa limite d'utilisations");
      } else {
        toast.error(error.message || "Erreur lors de la tentative de rejoindre la ligue");
      }
    } finally {
      setIsJoiningByCode(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Rejoindre une ligue publique</DialogTitle>
          <DialogDescription>
            Choisissez une ligue publique à rejoindre parmi la liste ci-dessous.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 max-h-[400px] overflow-y-auto">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Chargement des ligues...
            </div>
          ) : !publicLeagues || publicLeagues.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Globe className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>Aucune ligue publique disponible</p>
              <p className="text-sm mt-1">Créez votre propre ligue ou attendez qu'une ligue publique soit créée</p>
            </div>
          ) : (
            publicLeagues.map((league: any) => (
              <div
                key={league.id}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent transition-colors"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium">{league.name}</h4>
                    <Badge variant="outline" className="gap-1">
                      <Globe className="h-3 w-3" />
                      Publique
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Créée le {new Date(league.created_at).toLocaleDateString('fr-FR')}
                  </p>
                </div>
                
                <Button
                  onClick={() => handleJoinLeague(league.id)}
                  disabled={joiningLeagueId !== null}
                  size="sm"
                >
                  {joiningLeagueId === league.id ? "Inscription..." : "Rejoindre"}
                </Button>
              </div>
            ))
          )}
        </div>

        <div className="mt-6 space-y-4">
          <div className="flex items-center gap-2">
            <div className="h-px bg-border flex-1" />
            <span className="text-sm text-muted-foreground">ou</span>
            <div className="h-px bg-border flex-1" />
          </div>

          <div className="p-4 border rounded-lg space-y-3">
            <div className="flex items-start gap-2">
              <Lock className="h-4 w-4 mt-0.5 text-muted-foreground" />
              <div className="flex-1">
                <p className="font-medium text-sm mb-1">Rejoindre une ligue privée</p>
                <p className="text-sm text-muted-foreground mb-3">
                  Entrez le code d'invitation fourni par l'administrateur de la ligue.
                </p>
                
                <div className="flex gap-2">
                  <Input
                    placeholder="ABC123DEF456"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && inviteCode.trim()) {
                        handleJoinByCode();
                      }
                    }}
                    className="font-mono"
                    disabled={isJoiningByCode}
                  />
                  <Button
                    onClick={handleJoinByCode}
                    disabled={!inviteCode.trim() || isJoiningByCode}
                  >
                    {isJoiningByCode ? "Vérification..." : "Rejoindre"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
