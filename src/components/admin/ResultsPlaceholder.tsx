import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { InfoIcon } from "lucide-react";

export const ResultsPlaceholder = () => {
  return (
    <div className="p-6">
      <Alert>
        <InfoIcon className="h-4 w-4" />
        <AlertTitle>Section Résultats V1 désactivée</AlertTitle>
        <AlertDescription>
          La section Résultats V1 est désactivée. On repart sur une V2 plus simple.
        </AlertDescription>
      </Alert>
    </div>
  );
};
