import { useState } from "react";
import { Plus, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CreateLeagueDialog } from "@/components/leagues/CreateLeagueDialog";
import { JoinLeagueDialog } from "@/components/leagues/JoinLeagueDialog";

export function QuickActions() {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [joinDialogOpen, setJoinDialogOpen] = useState(false);

  return (
    <>
      <Card className="p-6 bg-gradient-to-br from-yellow-100 to-yellow-200 border border-gray-300 shadow-lg">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-center">
          <div className="text-center md:text-left md:flex-1">
            <h2 className="text-xl font-montserrat font-semibold mb-1 text-black">Nouvelle compétition</h2>
            <p className="text-sm text-gray-800 font-poppins">Créez votre ligue ou rejoignez-en une</p>
          </div>
          <div className="flex gap-3">
            <Button onClick={() => setCreateDialogOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Créer une ligue
            </Button>
            <Button onClick={() => setJoinDialogOpen(true)} variant="outline" className="gap-2">
              <Users className="h-4 w-4" />
              Rejoindre
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
