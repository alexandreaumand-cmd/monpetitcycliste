import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RoundManager } from "./RoundManager";
import { AuctionManager } from "./AuctionManager";
import { AnnouncementManager } from "./AnnouncementManager";
import { AuctionResetManager } from "./AuctionResetManager";

export const GameManagementTabs = () => {
  return (
    <Tabs defaultValue="rounds" className="w-full">
      <TabsList className="grid w-full grid-cols-4">
        <TabsTrigger value="rounds">🔨 Rounds</TabsTrigger>
        <TabsTrigger value="supervision">👁️ Supervision</TabsTrigger>
        <TabsTrigger value="announcements">📢 Annonces</TabsTrigger>
        <TabsTrigger value="reset">🗑️ Reset Enchères</TabsTrigger>
      </TabsList>

      <TabsContent value="rounds" className="space-y-6">
        <RoundManager />
      </TabsContent>

      <TabsContent value="supervision" className="space-y-6">
        <AuctionManager />
      </TabsContent>

      <TabsContent value="announcements" className="space-y-6">
        <AnnouncementManager />
      </TabsContent>

      <TabsContent value="reset" className="space-y-6">
        <AuctionResetManager />
      </TabsContent>
    </Tabs>
  );
};
