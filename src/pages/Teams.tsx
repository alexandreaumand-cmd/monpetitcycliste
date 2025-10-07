import { useIsMobile } from "@/hooks/use-mobile";
import { TeamsMobile } from "./Teams.mobile";
import { TeamsDesktop } from "./Teams.desktop";

export const Teams = () => {
  const isMobile = useIsMobile();
  return isMobile ? <TeamsMobile /> : <TeamsDesktop />;
};

export default Teams;
