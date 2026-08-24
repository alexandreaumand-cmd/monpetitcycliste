import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataImportManager } from "./DataImportManager";
import { DataExportManager } from "./DataExportManager";
import { MaintenanceTabs } from "./MaintenanceTabs";
import { SeasonManager } from "./SeasonManager";
import { TransfersManager } from "./TransfersManager";

export const DataManagementTabs = () => {
  return (
    <Tabs defaultValue="import" className="w-full">
      <TabsList className="grid w-full grid-cols-3 sm:grid-cols-5">
        <TabsTrigger value="import">📥 Import</TabsTrigger>
        <TabsTrigger value="export">📤 Export</TabsTrigger>
        <TabsTrigger value="seasons">📅 Saisons</TabsTrigger>
        <TabsTrigger value="transfers">🔁 <span className="hidden sm:inline">Transferts</span><span className="sm:hidden">Transf.</span></TabsTrigger>
        <TabsTrigger value="maintenance">🔧 <span className="hidden sm:inline">Maintenance</span><span className="sm:hidden">Maint.</span></TabsTrigger>
      </TabsList>

      <TabsContent value="import" className="space-y-6">
        <DataImportManager />
      </TabsContent>

      <TabsContent value="export" className="space-y-6">
        <DataExportManager />
      </TabsContent>

      <TabsContent value="seasons" className="space-y-6">
        <SeasonManager />
      </TabsContent>

      <TabsContent value="transfers" className="space-y-6">
        <TransfersManager />
      </TabsContent>

      <TabsContent value="maintenance" className="space-y-6">
        <MaintenanceTabs />
      </TabsContent>
    </Tabs>
  );
};
