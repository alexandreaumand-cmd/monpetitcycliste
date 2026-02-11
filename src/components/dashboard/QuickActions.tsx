import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CreateLeagueDialog } from "@/components/leagues/CreateLeagueDialog";
import { JoinLeagueDialog } from "@/components/leagues/JoinLeagueDialog";

export function QuickActions() {
  const { t } = useTranslation('dashboard');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [joinDialogOpen, setJoinDialogOpen] = useState(false);

  return (
    <>
      <Card className="p-6 bg-gradient-to-br from-yellow-100 to-yellow-200 dark:from-yellow-500/20 dark:to-yellow-600/20 border border-border shadow-lg">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-center">
          <div className="text-center md:text-left md:flex-1">
            <h2 className="text-xl font-montserrat font-semibold mb-1 text-foreground">{t('quickActions.title')}</h2>
            <p className="text-sm text-muted-foreground font-poppins">{t('quickActions.subtitle')}</p>
          </div>
          <div className="flex gap-3">
            <Button onClick={() => setCreateDialogOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              {t('quickActions.createLeague')}
            </Button>
            <Button onClick={() => setJoinDialogOpen(true)} variant="outline" className="gap-2">
              <Users className="h-4 w-4" />
              {t('quickActions.join')}
            </Button>
          </div>
        </div>
      </Card>

      <CreateLeagueDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />

      <JoinLeagueDialog
        open={joinDialogOpen}
        onOpenChange={setJoinDialogOpen}
      />
    </>
  );
}
