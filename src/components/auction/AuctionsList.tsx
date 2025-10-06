import { useIsMobile } from "@/hooks/use-mobile";
import { AuctionsListMobile } from "./AuctionsList.mobile";
import { AuctionsList as AuctionsListDesktop } from "./AuctionsList.desktop";

interface AuctionsListProps {
  managerId: string;
}

export const AuctionsList = ({ managerId }: AuctionsListProps) => {
  const isMobile = useIsMobile();
  return isMobile ? <AuctionsListMobile managerId={managerId} /> : <AuctionsListDesktop managerId={managerId} />;
};
