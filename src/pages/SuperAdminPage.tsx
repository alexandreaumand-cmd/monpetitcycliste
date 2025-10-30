import { useIsMobile } from "@/hooks/use-mobile";
import { SuperAdminPageDesktop } from "./SuperAdminPage.desktop";
import { SuperAdminPageMobile } from "./SuperAdminPage.mobile";

interface SuperAdminPageProps {
  manager: any;
  onSignOut: () => void;
}

export const SuperAdminPage = ({ manager, onSignOut }: SuperAdminPageProps) => {
  const isMobile = useIsMobile();

  return isMobile ? (
    <SuperAdminPageMobile manager={manager} onSignOut={onSignOut} />
  ) : (
    <SuperAdminPageDesktop manager={manager} onSignOut={onSignOut} />
  );
};
