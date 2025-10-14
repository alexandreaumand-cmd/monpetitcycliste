import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SeasonManager } from "./SeasonManager";
import { SponsorJerseyManager } from "./SponsorJerseyManager";
import { DataManagementTabs } from "./DataManagementTabs";

export const ConfigurationTabs = () => {
  return (
    <Tabs defaultValue="seasons" className="w-full">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="seasons">📅 Saisons</TabsTrigger>
        <TabsTrigger value="managers">👤 Managers</TabsTrigger>
        <TabsTrigger value="data">💾 Données</TabsTrigger>
      </TabsList>

      <TabsContent value="seasons" className="space-y-6">
        <SeasonManager />
      </TabsContent>

      <TabsContent value="managers" className="space-y-6">
        <SponsorJerseyManager />
      </TabsContent>

      <TabsContent value="data" className="space-y-6">
        <DataManagementTabs />
      </TabsContent>
    </Tabs>
  );
};
