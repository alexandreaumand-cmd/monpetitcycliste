import { useIsMobile } from "@/hooks/use-mobile";
import { AuctionPageMobile } from "./AuctionPageMobile";
import { AuctionPageDesktop } from "./AuctionPageDesktop";

interface AuctionPageV2Props {
  phaseId: string;
  managerId: string;
}

export function AuctionPageV2({ phaseId, managerId }: AuctionPageV2Props) {
  const isMobile = useIsMobile();

  return isMobile ? (
    <AuctionPageMobile phaseId={phaseId} managerId={managerId} />
  ) : (
    <AuctionPageDesktop phaseId={phaseId} managerId={managerId} />
  );
}
