import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Users, Globe } from "lucide-react";
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
      <Card className="p-4 sm:p-6 bg-card border border-border shadow-lg">
        <div className="flex flex-col gap-3 sm:gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="text-center sm:text-left">
              <h2 className="text-lg sm:text-xl font-montserrat font-semibold text-foreground">{t('quickActions.title')}</h2>
              <p className="text-xs sm:text-sm text-muted-foreground font-inter mt-0.5">{t('quickActions.subtitle')}</p>
            </div>
            <div className="flex gap-2 justify-center sm:justify-end shrink-0">
              <Button onClick={() => setCreateDialogOpen(true)} size="sm" className="gap-1.5 text-xs sm:text-sm sm:gap-2">
                <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                {t('quickActions.createLeague')}
              </Button>
              <Button onClick={() => setJoinDialogOpen(true)} variant="outline" size="sm" className="gap-1.5 text-xs sm:text-sm sm:gap-2">
                <Globe className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                {t('quickActions.join')}
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground text-center sm:text-left font-inter flex items-center justify-center sm:justify-start gap-1">
            <Globe className="h-3 w-3 shrink-0" />
            {t('quickActions.joinHint')}
          </p>
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
