import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TemplatesList } from "@/components/admin/communications/TemplatesList";
import { SendCommunicationForm } from "@/components/admin/communications/SendCommunicationForm";
import { CommunicationHistoryList } from "@/components/admin/communications/CommunicationHistoryList";
import type { CommunicationTemplate } from "@/hooks/useCommunicationTemplates";

export default function SuperAdminCommunicationsPage() {
  const [tab, setTab] = useState<"send" | "templates" | "history">("send");
  const [preselected, setPreselected] = useState<CommunicationTemplate | null>(null);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Communications</h1>
        <p className="text-sm text-muted-foreground">Envoyez des emails de communication générale aux utilisateurs inscrits.</p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList>
          <TabsTrigger value="send">Nouvel envoi</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="history">Historique</TabsTrigger>
        </TabsList>

        <TabsContent value="send" className="mt-4">
          <SendCommunicationForm
            initialTemplate={preselected}
            onSent={() => setTab("history")}
          />
        </TabsContent>

        <TabsContent value="templates" className="mt-4">
          <TemplatesList
            onUseTemplate={(t) => {
              setPreselected(t);
              setTab("send");
            }}
          />
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <CommunicationHistoryList />
        </TabsContent>
      </Tabs>
    </div>
  );
}
