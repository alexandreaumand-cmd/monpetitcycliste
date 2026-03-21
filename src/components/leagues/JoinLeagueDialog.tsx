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
import { useTranslation } from "react-i18next";

type JoinLeagueDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function JoinLeagueDialog({ open, onOpenChange }: JoinLeagueDialogProps) {
  const { t } = useTranslation('leagues');
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

      toast.success(t('join.success'));
      
      // Refresh leagues list
      await refetch();
      
      // Switch to new league
      setLeagueId(leagueId);
      
      // Redirect to auctions page
      navigate(`/dashboard/home?leagueId=${leagueId}`);
      
      // Close dialog
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error joining league:', error);
      toast.error(error.message || t('errors.joinError'));
    } finally {
      setJoiningLeagueId(null);
    }
  };

  const handleJoinByCode = async () => {
    if (!inviteCode.trim()) {
      toast.error(t('errors.enterCode'));
      return;
    }
    
    try {
      setIsJoiningByCode(true);
      
      const { data, error } = await supabase.functions.invoke('leagues-join-by-token', {
        body: { token: inviteCode.trim() },
      });
      
      if (error) throw error;
      
      toast.success(t('join.successWithName', { name: data.league_name }));
      
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
        toast.error(t('errors.invalidCode'));
      } else if (error.message?.includes('revoked')) {
        toast.error(t('errors.revokedInvite'));
      } else if (error.message?.includes('expired')) {
        toast.error(t('errors.expiredInvite'));
      } else if (error.message?.includes('limit reached')) {
        toast.error(t('errors.limitReached'));
      } else {
        toast.error(error.message || t('errors.joinError'));
      }
    } finally {
      setIsJoiningByCode(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{t('join.titlePublic')}</DialogTitle>
          <DialogDescription>
            {t('join.descriptionPublic')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 max-h-[400px] overflow-y-auto">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              {t('join.loadingLeagues')}
            </div>
          ) : !publicLeagues || publicLeagues.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Globe className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>{t('join.noPublicLeagues')}</p>
              <p className="text-sm mt-1">{t('join.noPublicLeaguesHint')}</p>
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
                      {t('join.public')}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {t('join.createdOn')} {new Date(league.created_at).toLocaleDateString('fr-FR')}
                  </p>
                </div>
                
                <Button
                  onClick={() => handleJoinLeague(league.id)}
                  disabled={joiningLeagueId !== null}
                  size="sm"
                >
                  {joiningLeagueId === league.id ? t('join.registering') : t('join.button')}
                </Button>
              </div>
            ))
          )}
        </div>

        <div className="mt-6 space-y-4">
          <div className="flex items-center gap-2">
            <div className="h-px bg-border flex-1" />
            <span className="text-sm text-muted-foreground">{t('join.or')}</span>
            <div className="h-px bg-border flex-1" />
          </div>

          <div className="p-4 border rounded-lg space-y-3">
            <div className="flex items-start gap-2">
              <Lock className="h-4 w-4 mt-0.5 text-muted-foreground" />
              <div className="flex-1">
                <p className="font-medium text-sm mb-1">{t('join.joinPrivate')}</p>
                <p className="text-sm text-muted-foreground mb-3">
                  {t('join.joinPrivateDesc')}
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
                    {isJoiningByCode ? t('join.verifying') : t('join.button')}
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
