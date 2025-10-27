import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataImportManager } from "./DataImportManager";
import { DataExportManager } from "./DataExportManager";
import { MaintenanceTabs } from "./MaintenanceTabs";

export const DataManagementTabs = () => {
  return (
    <Tabs defaultValue="import" className="w-full">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="import">📥 Import</TabsTrigger>
        <TabsTrigger value="export">📤 Export</TabsTrigger>
        <TabsTrigger value="maintenance">🔧 Maintenance</TabsTrigger>
      </TabsList>

      <TabsContent value="import" className="space-y-6">
        <DataImportManager />
      </TabsContent>

      <TabsContent value="export" className="space-y-6">
        <DataExportManager />
      </TabsContent>

      <TabsContent value="maintenance" className="space-y-6">
        <MaintenanceTabs />
      </TabsContent>
    </Tabs>
  );
};
