import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StartlistImportManager } from "./StartlistImportManager";
import { StartlistTracker } from "./StartlistTracker";
import { StartlistDataManager } from "./StartlistDataManager";

export const StartlistHub = () => {
  return (
    <Tabs defaultValue="import" className="w-full">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="import">📥 Import</TabsTrigger>
        <TabsTrigger value="tracker">📡 Tracker</TabsTrigger>
        <TabsTrigger value="data">📊 Données</TabsTrigger>
      </TabsList>

      <TabsContent value="import" className="space-y-6">
        <StartlistImportManager />
      </TabsContent>

      <TabsContent value="tracker" className="space-y-6">
        <StartlistTracker />
      </TabsContent>

      <TabsContent value="data" className="space-y-6">
        <StartlistDataManager />
      </TabsContent>
    </Tabs>
  );
};
