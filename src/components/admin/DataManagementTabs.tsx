import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataImportManager } from "./DataImportManager";
import { DataExportManager } from "./DataExportManager";
import { MaintenanceTabs } from "./MaintenanceTabs";
import { AuctionCleanupTab } from "./auctions/AuctionCleanupTab";
import { SeasonManager } from "./SeasonManager";

export const DataManagementTabs = () => {
  return (
    <Tabs defaultValue="import" className="w-full">
      <TabsList className="grid w-full grid-cols-5">
        <TabsTrigger value="import">📥 Import</TabsTrigger>
        <TabsTrigger value="export">📤 Export</TabsTrigger>
        <TabsTrigger value="auctions">🗑️ Enchères</TabsTrigger>
        <TabsTrigger value="seasons">📅 Saisons</TabsTrigger>
        <TabsTrigger value="maintenance">🔧 Maintenance</TabsTrigger>
      </TabsList>

      <TabsContent value="import" className="space-y-6">
        <DataImportManager />
      </TabsContent>

      <TabsContent value="export" className="space-y-6">
        <DataExportManager />
      </TabsContent>

      <TabsContent value="auctions" className="space-y-6">
        <AuctionCleanupTab />
      </TabsContent>

      <TabsContent value="seasons" className="space-y-6">
        <SeasonManager />
      </TabsContent>

      <TabsContent value="maintenance" className="space-y-6">
        <MaintenanceTabs />
      </TabsContent>
    </Tabs>
  );
};
