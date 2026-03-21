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
import { Globe, Lock, Users, Calendar, MapPin, Wallet, Bike, Gift } from "lucide-react";
import { useTranslation } from "react-i18next";

type JoinLeagueDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function JoinLeagueDialog({ open, onOpenChange }: JoinLeagueDialogProps) {
  const { t } = useTranslation('leagues');
  const { t: tDash } = useTranslation('dashboard');
  const navigate = useNavigate();
  const { setLeagueId } = useLeague();
  const { leagues: myLeagues, refetch } = useUserLeagues();
  const [joiningLeagueId, setJoiningLeagueId] = useState<string | null>(null);
  const [inviteCode, setInviteCode] = useState('');
  const [isJoiningByCode, setIsJoiningByCode] = useState(false);

  // Fetch public leagues with their scopes
  const { data: publicLeagues, isLoading } = useQuery({
    queryKey: ['public-leagues'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leagues')
        .select('*, league_scopes(*)')
        .eq('visibility', 'public')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const myLeagueIds = new Set(myLeagues.map(l => l.id));
      return (data || []).filter((league: any) => !myLeagueIds.has(league.id));
    },
    enabled: open,
  });

  // Fetch course names for all selected_course_ids across public leagues
  const allCourseIds = (publicLeagues || []).flatMap((l: any) => {
    const scope = l.league_scopes;
    const ids = Array.isArray(scope) ? scope[0]?.selected_course_ids : scope?.selected_course_ids;
    return ids || [];
  });

  const { data: coursesMap } = useQuery({
    queryKey: ['join-courses', allCourseIds.join(',')],
    queryFn: async () => {
      if (allCourseIds.length === 0) return {};
      const { data } = await supabase
        .from('courses')
        .select('id, nom, type_course, categorie')
        .in('id', allCourseIds);
      const map: Record<string, { nom: string; type_course: string; categorie: string }> = {};
      (data || []).forEach((c: any) => { map[c.id] = c; });
      return map;
    },
    enabled: allCourseIds.length > 0,
  });

  const handleJoinLeague = async (leagueId: string) => {
    try {
      setJoiningLeagueId(leagueId);
      const { data, error } = await supabase.functions.invoke('leagues-join', {
        body: { league_id: leagueId },
      });
      if (error) throw error;
      toast.success(t('join.success'));
      await refetch();
      setLeagueId(leagueId);
      navigate(`/dashboard/home?leagueId=${leagueId}`);
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
      await refetch();
      setLeagueId(data.league_id);
      navigate(`/dashboard/home?leagueId=${data.league_id}`);
      setInviteCode('');
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error joining by code:', error);
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

  const getGameModeLabel = (mode: string) => {
    if (mode === 'five_phases') return t('join.modeFivePhases');
    if (mode === 'per_course') return t('join.modePerCourse');
    return tDash(`leagueCard.gameMode.${mode}`, mode);
  };

  const renderLeagueCard = (league: any) => {
    const scope = league.league_scopes?.[0];
    const settings = league.settings as any;
    const selectedCourseIds: string[] = scope?.selected_course_ids || [];
    const budget = settings?.budget;
    const maxRiders = settings?.max_riders;

    return (
      <div
        key={league.id}
        className="border rounded-lg overflow-hidden hover:border-primary/40 transition-colors"
      >
        {/* Header */}
        <div className="p-3 sm:p-4 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-sm sm:text-base leading-tight truncate">{league.name}</h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t('join.createdOn')} {new Date(league.created_at).toLocaleDateString('fr-FR')}
              </p>
            </div>
            <Badge variant="outline" className="gap-1 shrink-0 text-xs">
              <Globe className="h-3 w-3" />
              {t('join.public')}
            </Badge>
          </div>

          {/* Details grid */}
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {getGameModeLabel(league.game_mode)}
            </span>
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {league.current_player_count}/{league.max_players}
            </span>
            {budget && (
              <span className="flex items-center gap-1">
                <Wallet className="h-3 w-3" />
                {budget}
              </span>
            )}
            {maxRiders && (
              <span className="flex items-center gap-1">
                <Bike className="h-3 w-3" />
                {maxRiders} {t('join.riders')}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Gift className="h-3 w-3" />
              {league.bonuses_enabled ? t('join.bonusesOn') : t('join.bonusesOff')}
            </span>
          </div>

          {/* Selected courses for per_course mode */}
          {league.game_mode === 'per_course' && selectedCourseIds.length > 0 && coursesMap && (
            <div className="flex flex-wrap gap-1.5 mt-1">
              <MapPin className="h-3 w-3 text-muted-foreground mt-0.5 shrink-0" />
              {selectedCourseIds.map((cId: string) => {
                const course = coursesMap[cId];
                return (
                  <Badge key={cId} variant="secondary" className="text-xs font-normal py-0">
                    {course?.nom || cId}
                  </Badge>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer with join button */}
        <div className="px-3 sm:px-4 pb-3 sm:pb-4">
          <Button
            onClick={() => handleJoinLeague(league.id)}
            disabled={joiningLeagueId !== null}
            size="sm"
            className="w-full"
          >
            {joiningLeagueId === league.id ? t('join.registering') : t('join.button')}
          </Button>
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{t('join.titlePublic')}</DialogTitle>
          <DialogDescription>
            {t('join.descriptionPublic')}
          </DialogDescription>
        </DialogHeader>

        {/* Public leagues list */}
        <div className="space-y-3 overflow-y-auto flex-1 pr-1">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              {t('join.loadingLeagues')}
            </div>
          ) : !publicLeagues || publicLeagues.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Globe className="h-10 w-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm">{t('join.noPublicLeagues')}</p>
              <p className="text-xs mt-1">{t('join.noPublicLeaguesHint')}</p>
            </div>
          ) : (
            publicLeagues.map((league: any) => renderLeagueCard(league))
          )}
        </div>

        {/* Divider */}
        <div className="flex items-center gap-2 my-2">
          <div className="h-px bg-border flex-1" />
          <span className="text-xs text-muted-foreground">{t('join.or')}</span>
          <div className="h-px bg-border flex-1" />
        </div>

        {/* Private league section */}
        <div className="p-3 sm:p-4 border rounded-lg space-y-3">
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-muted-foreground shrink-0" />
            <div>
              <p className="font-medium text-sm">{t('join.joinPrivate')}</p>
              <p className="text-xs text-muted-foreground">{t('join.joinPrivateDesc')}</p>
            </div>
          </div>
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
              className="font-mono text-sm"
              disabled={isJoiningByCode}
            />
            <Button
              onClick={handleJoinByCode}
              disabled={!inviteCode.trim() || isJoiningByCode}
              size="sm"
              className="shrink-0"
            >
              {isJoiningByCode ? t('join.verifying') : t('join.button')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
