import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Zap, AlertCircle, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatAmount } from "@/lib/utils";
import { useAuctionOperations } from "@/hooks/useAuctionOperations";
import { useManagerStatus } from "@/hooks/useManagerStatus";

export const AuctionManager = () => {
  const {
    phases,
    loadingPhases,
    activeAuctions,
    closedAuctions,
    activePhase,
    nextRoundNumber,
    selectedPhase,
    setSelectedPhase,
    roundNumber,
    setRoundNumber,
    deadlineHours,
    setDeadlineHours,
    resetPhrase,
    setResetPhrase,
    quickLaunchAuction,
    createAuction,
    closeAuction,
    reprocessRound,
    resetPhase,
  } = useAuctionOperations();

  const { managersStatus, getManagerStatus } = useManagerStatus(activePhase?.id);

  if (loadingPhases) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Active Auctions */}
      <Card>
        <CardHeader>
          <CardTitle>Enchères en cours</CardTitle>
        </CardHeader>
        <CardContent>
          {!activeAuctions || activeAuctions.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">Aucune enchère en cours</p>
          ) : (
            <div className="space-y-3">
              {activeAuctions.map((auction) => (
                <div key={auction.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">Tour {auction.round_number}</p>
                    <p className="text-sm text-muted-foreground">
                      Deadline: {new Date(auction.deadline_at).toLocaleString()}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => closeAuction.mutate(auction.id)}
                    disabled={closeAuction.isPending}
                  >
                    {closeAuction.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Clôturer
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Closed Auctions - Reprocess */}
      {closedAuctions && closedAuctions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              Enchères fermées récentes
            </CardTitle>
            <CardDescription>
              Retraiter un round si les annonces n'ont pas été créées correctement
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {closedAuctions.map((auction) => (
                <div key={auction.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">Tour {auction.round_number}</p>
                    <p className="text-sm text-muted-foreground">
                      Clôturé le: {auction.closed_at ? new Date(auction.closed_at).toLocaleString() : 'N/A'}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => reprocessRound.mutate(auction.id)}
                    disabled={reprocessRound.isPending}
                  >
                    {reprocessRound.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Retraiter
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Manager Status for Active Phase */}
      {activePhase && managersStatus.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>État des managers - Round en cours</CardTitle>
            <CardDescription>
              Suivi de la soumission des enchères pour le round actif
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Manager</TableHead>
                  <TableHead className="text-center">Slots restants</TableHead>
                  <TableHead className="text-center">Enchères pending</TableHead>
                  <TableHead className="text-center">Budget restant</TableHead>
                  <TableHead className="text-center">Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {managersStatus
                  .sort((a, b) => {
                    const statusA = getManagerStatus(a);
                    const statusB = getManagerStatus(b);
                    if (statusA.label === "En attente" && statusB.label !== "En attente") return -1;
                    if (statusA.label !== "En attente" && statusB.label === "En attente") return 1;
                    return a.manager_nom.localeCompare(b.manager_nom);
                  })
                  .map((manager) => {
                    const status = getManagerStatus(manager);
                    return (
                      <TableRow key={manager.manager_id}>
                        <TableCell className="font-medium">{manager.manager_nom}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline">{manager.slots_restants}</Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className={manager.pending_count !== manager.slots_restants ? "text-orange-600" : "text-green-600"}>
                            {manager.pending_count} / {manager.slots_restants}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className={Math.abs(parseFloat(manager.budget_restant.toString()) - parseFloat(manager.pending_sum.toString())) >= 1 ? "text-orange-600" : "text-green-600"}>
                            {formatAmount(manager.pending_sum)} / {formatAmount(manager.budget_restant)}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge
                            variant={status.variant}
                            className="flex items-center gap-1 justify-center"
                          >
                            {status.icon}
                            {status.label}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Quick Launch Section */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            Lancement Rapide
          </CardTitle>
          <CardDescription>
            {activePhase ? (
              <>Phase active: {new Date(activePhase.date_debut).toLocaleDateString()} - {new Date(activePhase.date_fin).toLocaleDateString()}</>
            ) : (
              "Aucune phase active"
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {activePhase ? (
            <>
              <div className="flex items-center justify-between p-4 bg-background/50 rounded-lg">
                <div>
                  <p className="font-medium">Prochain tour: {nextRoundNumber}</p>
                  <p className="text-sm text-muted-foreground">Deadline: 24h automatique</p>
                </div>
                <Badge variant="outline">{formatAmount(activePhase.budget)} de budget</Badge>
              </div>
              <Button
                onClick={() => quickLaunchAuction.mutate()}
                disabled={quickLaunchAuction.isPending}
                size="lg"
                className="w-full"
              >
                {quickLaunchAuction.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Zap className="mr-2 h-4 w-4" />
                Lancer le Tour {nextRoundNumber}
              </Button>
            </>
          ) : (
            <div className="text-center py-4">
              <p className="text-muted-foreground mb-4">Aucune phase active. Veuillez d'abord activer une phase dans l'onglet Saisons.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Advanced Options */}
      <Card>
        <CardHeader>
          <CardTitle>Options avancées</CardTitle>
          <CardDescription>Personnaliser les paramètres de l'enchère</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Phase</Label>
            <Select value={selectedPhase} onValueChange={setSelectedPhase}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner une phase" />
              </SelectTrigger>
              <SelectContent>
                {phases?.map((phase) => (
                  <SelectItem key={phase.id} value={phase.id}>
                    Phase {phase.index_dans_saison} ({new Date(phase.date_debut).toLocaleDateString()} - {new Date(phase.date_fin).toLocaleDateString()})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Numéro de tour</Label>
              <Input
                type="number"
                min="1"
                value={roundNumber}
                onChange={(e) => setRoundNumber(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Deadline (heures)</Label>
              <Input
                type="number"
                min="1"
                value={deadlineHours}
                onChange={(e) => setDeadlineHours(e.target.value)}
              />
            </div>
          </div>

          <Button
            onClick={() => createAuction.mutate()}
            disabled={createAuction.isPending || !selectedPhase}
            className="w-full"
          >
            {createAuction.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Lancer l'enchère
          </Button>
        </CardContent>
      </Card>

      {/* Reset Phase */}
      {activePhase && (() => {
        const expectedPhrase = `RESET PHASE ${activePhase.index_dans_saison} ${activePhase.saisons?.annee || ''}`.trim();
        return (
          <Card className="border-destructive/20 bg-destructive/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <Trash2 className="h-5 w-5" />
                Zone dangereuse
              </CardTitle>
              <CardDescription>
                Remise à zéro complète de la phase en cours
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" className="w-full">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Réinitialiser Phase {activePhase.index_dans_saison} {activePhase.saisons?.annee}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>⚠️ Confirmer la réinitialisation</AlertDialogTitle>
                    <AlertDialogDescription className="space-y-4">
                      <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="destructive" className="text-xs">⚠️ PHASE ACTIVE</Badge>
                        </div>
                        <p className="font-semibold text-foreground">
                          Phase {activePhase.index_dans_saison} {activePhase.saisons?.annee}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Du {new Date(activePhase.date_debut).toLocaleDateString()} au {new Date(activePhase.date_fin).toLocaleDateString()}
                        </p>
                      </div>
                      <p className="text-foreground">Cette action va <strong>supprimer définitivement</strong> :</p>
                      <ul className="list-disc list-inside space-y-1 text-sm">
                        <li>Tous les rosters des managers</li>
                        <li>Toutes les enchères (gagnées et perdues)</li>
                        <li>Toutes les annonces publiées</li>
                        <li>Toutes les auctions créées</li>
                      </ul>
                      <p className="text-destructive font-semibold">Cette action est IRRÉVERSIBLE.</p>
                      <div className="mt-4">
                        <Label htmlFor="reset-phrase">
                          Tapez <code className="bg-muted px-2 py-1 rounded text-xs">{expectedPhrase}</code> pour confirmer :
                        </Label>
                        <Input
                          id="reset-phrase"
                          value={resetPhrase}
                          onChange={(e) => setResetPhrase(e.target.value)}
                          placeholder={expectedPhrase}
                          className="mt-2"
                        />
                      </div>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setResetPhrase("")}>Annuler</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => resetPhase.mutate()}
                      disabled={resetPhrase !== expectedPhrase || resetPhase.isPending}
                      className="bg-destructive hover:bg-destructive/90"
                    >
                      {resetPhase.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Confirmer la suppression
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardContent>
          </Card>
        );
      })()}
    </div>
  );
};
