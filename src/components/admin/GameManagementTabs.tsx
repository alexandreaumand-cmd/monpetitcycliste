import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RoundControlCenter } from "./RoundControlCenter";
import { AuctionResetManager } from "./AuctionResetManager";

export const GameManagementTabs = () => {
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
