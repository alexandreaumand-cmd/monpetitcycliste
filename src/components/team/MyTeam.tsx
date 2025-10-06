import { useIsMobile } from "@/hooks/use-mobile";
import { MyTeamMobile } from "./MyTeam.mobile";
import { MyTeamDesktop } from "./MyTeam.desktop";

export const MyTeam = () => {
  const isMobile = useIsMobile();
  return isMobile ? <MyTeamMobile /> : <MyTeamDesktop />;
};

export default MyTeam;
