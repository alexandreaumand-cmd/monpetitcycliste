import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MobileBottomSheet } from "@/components/mobile/MobileBottomSheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { Copy, Link, Users, Share2 } from "lucide-react";
import { useLeagueMembers } from "@/hooks/useLeagueMembers";
import { toast } from "sonner";

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
  const { t } = useTranslation('leagues');
  const isMobile = useIsMobile();
  
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteToken, setInviteToken] = useState<string>("");
  const [inviteUrl, setInviteUrl] = useState<string>("");

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
      getOrCreateToken();
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

  const getOrCreateToken = async () => {
    try {
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
      
      const url = `${window.location.origin}/i/${token}`;
      setInviteToken(token);
      setInviteUrl(url);
      return { token, url };
    } catch (error: any) {
      toast.error(t('inviteSheet.createError'));
      return { token: "", url: "" };
    }
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(inviteToken);
      toast.success(t('inviteSheet.codeCopied'));
    } catch (error) {
      toast.error(t('inviteSheet.copyError'));
    }
  };

  const handleCopyLink = async () => {
    if (!inviteUrl) return;
    
    const inviteText = t('inviteSheet.shareMessage', { leagueName, url: inviteUrl });
    
    try {
      await navigator.clipboard.writeText(inviteText);
      toast.success(t('inviteSheet.inviteCopied'));
    } catch (error) {
      toast.error(t('inviteSheet.copyError'));
    }
  };

  const handleShareWhatsApp = () => {
    if (!inviteUrl) return;
    
    const message = t('inviteSheet.shareMessage', { leagueName, url: inviteUrl });
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  const handleNativeShare = async () => {
    if (!inviteUrl) return;
    
    const shareData = {
      title: t('inviteSheet.shareTitle'),
      text: t('inviteSheet.shareText', { leagueName }),
      url: inviteUrl,
    };
    
    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        // Share cancelled or error
        console.log('Share cancelled');
      }
    } else {
      // Fallback: copy text
      handleCopyLink();
    }
  };

  const content = (
    <div className="space-y-6">
      {/* Section: Current members */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">{t('inviteSheet.leagueMembers')}</h3>
        </div>
        <div className="bg-muted/50 rounded-lg p-4">
          {loadingMembers ? (
            <p className="text-sm text-muted-foreground text-center">{t('inviteSheet.loading')}</p>
          ) : members.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center">
              {t('inviteSheet.noMembers')}
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

      {/* Section: Remaining spots */}
      <div className="bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-950/20 dark:to-orange-950/20 rounded-lg p-4 border border-yellow-200 dark:border-yellow-800">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">{t('inviteSheet.remainingSpots')}</span>
          <span className="text-2xl font-bold text-primary">
            {remainingSpots}
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {currentPlayerCount} / {maxPlayers} {t('inviteSheet.players')}
        </p>
      </div>

      {/* Section: Invite code */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Copy className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">{t('inviteSheet.inviteCode')}</h3>
        </div>
        <div className="bg-muted/50 rounded-lg p-4">
          <div className="flex flex-col gap-3">
            <code className="text-base sm:text-lg font-mono font-semibold tracking-wider break-all">
              {inviteToken || t('inviteSheet.loading')}
            </code>
            <Button
              size="sm"
              variant="outline"
              onClick={handleCopyCode}
              disabled={!inviteToken}
              className="w-full sm:w-auto"
            >
              <Copy className="h-4 w-4 mr-2" />
              {t('inviteSheet.copy')}
            </Button>
          </div>
        </div>
      </div>

      {/* Section: Invite link */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Link className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">{t('inviteSheet.inviteLink')}</h3>
        </div>
        <div className="flex flex-col gap-2">
          {/* Short link display */}
          <div className="p-3 bg-muted rounded-md border">
            <code className="text-sm break-all font-mono">
              {inviteUrl ? inviteUrl.replace(window.location.origin, '') : t('inviteSheet.loading')}
            </code>
          </div>
          
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyLink}
              disabled={!inviteUrl}
              className="flex-1"
            >
              <Copy className="h-4 w-4 mr-2" />
              {t('inviteSheet.copyInvite')}
            </Button>
            
            {navigator.share && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleNativeShare}
                disabled={!inviteUrl}
              >
                <Share2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Section: WhatsApp share */}
      <Button 
        onClick={handleShareWhatsApp}
        disabled={!inviteUrl}
        size="lg"
        className="w-full h-14 text-base bg-[#25D366] hover:bg-[#20BD5A] text-white shadow-lg"
      >
        <svg className="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
        </svg>
        {t('inviteSheet.shareWhatsApp')}
      </Button>
    </div>
  );

  if (isMobile) {
    return (
      <MobileBottomSheet
        open={open}
        onOpenChange={onOpenChange}
        title={t('inviteSheet.title')}
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
          <DialogTitle>{t('inviteSheet.title')}</DialogTitle>
          <DialogDescription>{leagueName}</DialogDescription>
        </DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
  );
}
