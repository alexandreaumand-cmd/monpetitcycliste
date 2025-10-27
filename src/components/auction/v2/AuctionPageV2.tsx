import { useIsMobile } from "@/hooks/use-mobile";
import { AuctionPageMobile } from "./AuctionPageMobile";
import { AuctionPageDesktop } from "./AuctionPageDesktop";

interface AuctionPageV2Props {
  phaseId: string;
  managerId: string;
  leagueId: string | null;
}

export function AuctionPageV2({ phaseId, managerId, leagueId }: AuctionPageV2Props) {
  const isMobile = useIsMobile();

  return isMobile ? (
    <AuctionPageMobile phaseId={phaseId} managerId={managerId} leagueId={leagueId} />
  ) : (
    <AuctionPageDesktop phaseId={phaseId} managerId={managerId} leagueId={leagueId} />
  );
}
