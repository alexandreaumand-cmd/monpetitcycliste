import { useNavigate } from "react-router-dom";
import { useManagerSponsor } from "@/hooks/useManagerSponsor";
import { useSeasonContext } from "@/contexts/SeasonContext";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { ExternalLink } from "lucide-react";

interface ManagerNameWithJerseyProps {
  managerId: string;
  managerName: string;
  /** Show a discreet link to the manager profile page (default: true) */
  linkToProfile?: boolean;
}

export function ManagerNameWithJersey({
  managerId,
  managerName,
  linkToProfile = true,
}: ManagerNameWithJerseyProps) {
  const { selectedSeason } = useSeasonContext();
  const { data: sponsorData } = useManagerSponsor(managerId, selectedSeason?.id);
  const navigate = useNavigate();

  return (
    <div className="flex items-center gap-2">
      {sponsorData?.jersey_image_url ? (
        <Avatar className="h-6 w-6">
          <AvatarImage src={sponsorData.jersey_image_url} alt={sponsorData.sponsor} />
          <AvatarFallback>{managerName[0]}</AvatarFallback>
        </Avatar>
      ) : (
        <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
          {managerName[0]}
        </div>
      )}
      <span className="font-medium">{managerName}</span>
      {linkToProfile && (
        <button
          type="button"
          aria-label={`Profil ${managerName}`}
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/dashboard/manager/${managerId}`);
          }}
          className="text-muted-foreground/60 transition-colors hover:text-primary"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
