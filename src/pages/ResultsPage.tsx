import { useIsMobile } from "@/hooks/use-mobile";
import { ResultsPageMobile } from "./ResultsPage.mobile";
import { ResultsPage as ResultsPageDesktop } from "./ResultsPage.desktop";

export const ResultsPage = () => {
  const isMobile = useIsMobile();
  return isMobile ? <ResultsPageMobile /> : <ResultsPageDesktop />;
};
