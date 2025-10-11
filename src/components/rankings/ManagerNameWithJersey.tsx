import { useManagerSponsor } from "@/hooks/useManagerSponsor";
import { useSeasonContext } from "@/contexts/SeasonContext";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

interface ManagerNameWithJerseyProps {
  managerId: string;
  managerName: string;
}

export function ManagerNameWithJersey({ managerId, managerName }: ManagerNameWithJerseyProps) {
  const { selectedSeason } = useSeasonContext();
  const { data: sponsorData } = useManagerSponsor(managerId, selectedSeason?.id);

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
    </div>
  );
}
