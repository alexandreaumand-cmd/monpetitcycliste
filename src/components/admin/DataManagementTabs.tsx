import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataImportManager } from "./DataImportManager";
import { DataExportManager } from "./DataExportManager";

export const DataManagementTabs = () => {
  return (
    <Tabs defaultValue="import" className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="import">📥 Import</TabsTrigger>
        <TabsTrigger value="export">📤 Export</TabsTrigger>
      </TabsList>

      <TabsContent value="import" className="space-y-6">
        <DataImportManager />
      </TabsContent>

      <TabsContent value="export" className="space-y-6">
        <DataExportManager />
      </TabsContent>
    </Tabs>
  );
};
