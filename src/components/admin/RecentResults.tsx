import { useIsMobile } from "@/hooks/use-mobile";
import { RecentResultsMobile } from "./RecentResults.mobile";
import { RecentResults as RecentResultsDesktop } from "./RecentResults.desktop";

export const RecentResults = () => {
  const isMobile = useIsMobile();
  return isMobile ? <RecentResultsMobile /> : <RecentResultsDesktop />;
};
