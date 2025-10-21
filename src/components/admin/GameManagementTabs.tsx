import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RoundControlCenter } from "./RoundControlCenter";
import { AuctionResetManager } from "./AuctionResetManager";
import { useLeague } from "@/contexts/LeagueContext";
import { useUserRole } from "@/hooks/useUserRole";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

export const GameManagementTabs = () => {
  const { leagueId } = useLeague();
  const { isLeagueAdminOnly } = useUserRole();

  if (isLeagueAdminOnly && !leagueId) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Veuillez sélectionner une ligue dans l'onglet "Ligues" pour gérer les enchères.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Tabs defaultValue="control" className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="control">🎯 Round Control</TabsTrigger>
        <TabsTrigger value="danger">⚠️ Danger Zone</TabsTrigger>
      </TabsList>

      <TabsContent value="control" className="space-y-6">
        <RoundControlCenter />
      </TabsContent>

      <TabsContent value="danger" className="space-y-6">
        <AuctionResetManager />
      </TabsContent>
    </Tabs>
  );
};
