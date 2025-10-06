import { useIsMobile } from "@/hooks/use-mobile";
import { StartlistMobile } from "./Startlist.mobile";
import StartlistDesktop from "./Startlist.desktop";

// Thin responsive wrapper to avoid hook order mismatches
const Startlist = () => {
  const isMobile = useIsMobile();
  return isMobile ? <StartlistMobile /> : <StartlistDesktop />;
};

export default Startlist;
