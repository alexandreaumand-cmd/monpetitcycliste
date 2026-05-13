import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TemplatesList } from "@/components/admin/communications/TemplatesList";
import { SendCommunicationForm } from "@/components/admin/communications/SendCommunicationForm";
import { CommunicationHistoryList } from "@/components/admin/communications/CommunicationHistoryList";
import { TransactionalHistoryList } from "@/components/admin/communications/TransactionalHistoryList";
import type { CommunicationTemplate } from "@/hooks/useCommunicationTemplates";

export default function SuperAdminCommunicationsPage() {
  const [tab, setTab] = useState<"send" | "templates" | "history">("send");
  const [historySubTab, setHistorySubTab] = useState<"manual" | "auto">("manual");
  const [preselected, setPreselected] = useState<CommunicationTemplate | null>(null);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold">Communications</h1>
        <p className="text-xs sm:text-sm text-muted-foreground">Envoyez des emails de communication générale aux utilisateurs inscrits.</p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList className="w-full sm:w-auto grid grid-cols-3 sm:inline-flex">
          <TabsTrigger value="send" className="text-xs sm:text-sm">Nouvel envoi</TabsTrigger>
          <TabsTrigger value="templates" className="text-xs sm:text-sm">Templates</TabsTrigger>
          <TabsTrigger value="history" className="text-xs sm:text-sm">Historique</TabsTrigger>
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

        <TabsContent value="history" className="mt-4 space-y-4">
          <Tabs value={historySubTab} onValueChange={(v) => setHistorySubTab(v as any)}>
            <TabsList className="w-full sm:w-auto grid grid-cols-2 sm:inline-flex">
              <TabsTrigger value="manual" className="text-xs sm:text-sm">Campagnes manuelles</TabsTrigger>
              <TabsTrigger value="auto" className="text-xs sm:text-sm">Mails automatiques</TabsTrigger>
            </TabsList>
            <TabsContent value="manual" className="mt-4">
              <CommunicationHistoryList />
            </TabsContent>
            <TabsContent value="auto" className="mt-4">
              <TransactionalHistoryList />
            </TabsContent>
          </Tabs>
        </TabsContent>
      </Tabs>
    </div>
  );
}
