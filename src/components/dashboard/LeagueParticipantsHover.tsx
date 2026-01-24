import { useState, forwardRef } from "react";
import { useTranslation } from "react-i18next";
import { Users, Crown } from "lucide-react";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Skeleton } from "@/components/ui/skeleton";
import { useIsMobile } from "@/hooks/use-mobile";
import { MobileBottomSheet } from "@/components/mobile/MobileBottomSheet";

interface LeagueParticipantsHoverProps {
  ownerName: string | null;
  members: Array<{ id: string; name: string; joinedAt: string }>;
  currentPlayerCount: number;
  isLoading?: boolean;
}

export function LeagueParticipantsHover({ 
  ownerName, 
  members, 
  currentPlayerCount,
  isLoading 
}: LeagueParticipantsHoverProps) {
  const { t } = useTranslation('dashboard');
  const isMobile = useIsMobile();
  const [sheetOpen, setSheetOpen] = useState(false);

  // Contenu commun aux deux versions
  const ParticipantsContent = () => (
    <div className="space-y-3">
      {/* Admin Section */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Crown className="h-4 w-4 text-[#FFD500]" />
          <h4 className="font-semibold text-sm">{t('leagueCard.participantsHover.administrator')}</h4>
        </div>
        {isLoading ? (
          <Skeleton className="h-6 w-full" />
        ) : (
          <p className="text-sm text-muted-foreground pl-6">
            {ownerName || t('leagueCard.participantsHover.unknown')}
          </p>
        )}
      </div>

      {/* Participants Section */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Users className="h-4 w-4 text-primary" />
          <h4 className="font-semibold text-sm">
            {t('leagueCard.participantsHover.participants')} ({members.length})
          </h4>
        </div>
        {isLoading ? (
          <div className="space-y-1">
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-full" />
          </div>
        ) : members.length === 0 ? (
          <p className="text-sm text-muted-foreground italic pl-6">
            {t('leagueCard.participantsHover.noParticipants')}
          </p>
        ) : (
          <ul className="space-y-1 pl-6">
            {members.map((member) => (
              <li 
                key={member.id} 
                className="text-sm text-muted-foreground flex items-center gap-2"
              >
                <div className="w-1 h-1 rounded-full bg-primary" />
                {member.name}
                {ownerName === member.name && (
                  <Crown className="h-3 w-3 text-[#FFD500] ml-1" />
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );

  // Trigger avec forwardRef pour que Radix UI puisse attacher la ref
  const TriggerElement = forwardRef<HTMLSpanElement, { onClick?: () => void }>(
    ({ onClick, ...props }, ref) => (
      <span 
        ref={ref}
        className="text-sm font-medium cursor-help hover:text-primary transition-colors flex items-center gap-1.5"
        onClick={onClick}
        {...props}
      >
        <Users className="h-3.5 w-3.5" />
        {currentPlayerCount} {currentPlayerCount > 1 
          ? t('leagueCard.participantsHover.players') 
          : t('leagueCard.participantsHover.player')}
      </span>
    )
  );
  TriggerElement.displayName = 'TriggerElement';

  // VERSION MOBILE : Bottom Sheet
  if (isMobile) {
    return (
      <>
        <TriggerElement onClick={() => setSheetOpen(true)} />
        <MobileBottomSheet
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          title={t('leagueCard.participantsHover.title')}
        >
          <ParticipantsContent />
        </MobileBottomSheet>
      </>
    );
  }

  // VERSION DESKTOP : HoverCard
  return (
    <HoverCard>
      <HoverCardTrigger asChild>
        <TriggerElement />
      </HoverCardTrigger>
      <HoverCardContent className="w-72" side="bottom" align="end">
        <ParticipantsContent />
      </HoverCardContent>
    </HoverCard>
  );
}
