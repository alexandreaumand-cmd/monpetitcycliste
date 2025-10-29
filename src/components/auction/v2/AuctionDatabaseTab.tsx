import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Database, Search, ChevronDown, ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

interface AuctionDatabaseTabProps {
  phaseId: string;
  leagueId: string | null;
}

interface AuctionData {
  coureur_id: string;
  coureur_nom: string;
  coureur_equipe: string;
  round_number: number;
  winning_amount: number;
  winning_manager: string;
  manager_id: string;
  cote_initiale: number;
  roi: number;
  concurrents_battus: Array<{
    manager_id: string;
    manager_nom: string;
    my_bid: number;
  }>;
}

type SortField = "coureur_nom" | "cote_initiale" | "winning_amount" | "round_number" | "winning_manager";
type SortDirection = "asc" | "desc";

export function AuctionDatabaseTab({ phaseId, leagueId }: AuctionDatabaseTabProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedManager, setSelectedManager] = useState<string>("all");
  const [selectedRound, setSelectedRound] = useState<string>("all");
  const [priceRange, setPriceRange] = useState([0, 500]);
  const [sortField, setSortField] = useState<SortField>("round_number");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const { data: allAuctionData = [], isLoading } = useQuery({
    queryKey: ["auction-database", phaseId, leagueId],
    queryFn: async () => {
      let winnersQuery = supabase
        .from("bids_outcomes")
        .select("coureur_id, coureur_nom, coureur_equipe, round_number, winning_amount, winning_manager, manager_id")
        .eq("phase_id", phaseId)
        .eq("outcome", "won");

      if (leagueId) winnersQuery = winnersQuery.eq("league_id", leagueId);

      const { data: winners, error: winnersError } = await winnersQuery;
      if (winnersError) throw winnersError;

      if (!winners || winners.length === 0) return [];

      const coureurIds = [...new Set(winners.map((w) => w.coureur_id))];
      const { data: coureurs, error: coteError } = await supabase
        .from("coureurs")
        .select("id, prix_initial")
        .in("id", coureurIds);

      if (coteError) throw coteError;

      let losersQuery = supabase
        .from("bids_outcomes")
        .select(`
          coureur_id,
          round_number,
          my_bid,
          manager_id,
          managers!inner(nom)
        `)
        .eq("phase_id", phaseId)
        .eq("outcome", "lost")
        .in("coureur_id", coureurIds);

      if (leagueId) losersQuery = losersQuery.eq("league_id", leagueId);

      const { data: losers, error: losersError } = await losersQuery;
      if (losersError) throw losersError;

      return winners.map((w) => {
        const cote = coureurs?.find((c) => c.id === w.coureur_id)?.prix_initial || 0;
        const concurrents = (losers || [])
          .filter((l: any) => l.coureur_id === w.coureur_id && l.round_number === w.round_number)
          .map((l: any) => ({
            manager_id: l.manager_id as string,
            manager_nom: l.managers?.nom || "Inconnu",
            my_bid: l.my_bid as number,
          }));
        const roi = cote > 0 ? ((w.winning_amount - cote) / cote) * 100 : 0;

        return {
          ...w,
          cote_initiale: cote,
          roi,
          concurrents_battus: concurrents,
        } as AuctionData;
      });
    },
  });

  const filteredAndSortedData = useMemo(() => {
    let filtered = allAuctionData.filter((item) => {
      const matchesSearch = item.coureur_nom.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesManager = selectedManager === "all" || item.winning_manager === selectedManager;
      const matchesRound = selectedRound === "all" || item.round_number.toString() === selectedRound;
      const matchesPrice = item.winning_amount >= priceRange[0] && item.winning_amount <= priceRange[1];

      return matchesSearch && matchesManager && matchesRound && matchesPrice;
    });

    filtered.sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      
      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortDirection === "asc" 
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }
      
      return sortDirection === "asc" 
        ? (aVal as number) - (bVal as number)
        : (bVal as number) - (aVal as number);
    });

    return filtered;
  }, [allAuctionData, searchTerm, selectedManager, selectedRound, priceRange, sortField, sortDirection]);

  const uniqueManagers = useMemo(() => {
    return [...new Set(allAuctionData.map((item) => item.winning_manager))].sort();
  }, [allAuctionData]);

  const uniqueRounds = useMemo(() => {
    return [...new Set(allAuctionData.map((item) => item.round_number))].sort((a, b) => a - b);
  }, [allAuctionData]);

  const toggleRow = (coureurId: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(coureurId)) {
      newExpanded.delete(coureurId);
    } else {
      newExpanded.add(coureurId);
    }
    setExpandedRows(newExpanded);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };


  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-30" />;
    return sortDirection === "asc" ? (
      <ChevronDown className="h-3 w-3 ml-1 rotate-180" />
    ) : (
      <ChevronDown className="h-3 w-3 ml-1" />
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">Chargement des données...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="bg-gradient-to-r from-primary/10 via-primary/5 to-background">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-xl">
              <Database className="h-5 w-5 text-primary" />
              Base de données des Enchères
            </CardTitle>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>{filteredAndSortedData.length} coureur{filteredAndSortedData.length > 1 ? "s" : ""}</span>
              <span>•</span>
              <span>{uniqueRounds.length} round{uniqueRounds.length > 1 ? "s" : ""}</span>
              <span>•</span>
              <span>{uniqueManagers.length} manager{uniqueManagers.length > 1 ? "s" : ""}</span>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-6">
          {/* Filters */}
          <div className="grid gap-4 mb-6 sm:grid-cols-2 lg:grid-cols-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher un coureur..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>

            <Select value={selectedManager} onValueChange={setSelectedManager}>
              <SelectTrigger>
                <SelectValue placeholder="Tous les managers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les managers</SelectItem>
                {uniqueManagers.map((manager) => (
                  <SelectItem key={manager} value={manager}>
                    {manager}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedRound} onValueChange={setSelectedRound}>
              <SelectTrigger>
                <SelectValue placeholder="Tous les rounds" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les rounds</SelectItem>
                {uniqueRounds.map((round) => (
                  <SelectItem key={round} value={round.toString()}>
                    Round {round}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="space-y-2">
              <div className="flex justify-between text-xs text-muted-foreground">
              <span>Prix: {priceRange[0]}</span>
              <span>{priceRange[1]}</span>
              </div>
              <Slider
                min={0}
                max={500}
                step={10}
                value={priceRange}
                onValueChange={setPriceRange}
              />
            </div>
          </div>


          {/* Table */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]"></TableHead>
                  <TableHead>
                    <Button variant="ghost" size="sm" onClick={() => handleSort("coureur_nom")} className="h-8 px-2">
                      Coureur
                      <SortIcon field="coureur_nom" />
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button variant="ghost" size="sm" onClick={() => handleSort("cote_initiale")} className="h-8 px-2">
                      Cote
                      <SortIcon field="cote_initiale" />
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button variant="ghost" size="sm" onClick={() => handleSort("winning_amount")} className="h-8 px-2">
                      Prix d'achat
                      <SortIcon field="winning_amount" />
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button variant="ghost" size="sm" onClick={() => handleSort("winning_manager")} className="h-8 px-2">
                      Manager
                      <SortIcon field="winning_manager" />
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button variant="ghost" size="sm" onClick={() => handleSort("round_number")} className="h-8 px-2">
                      Round
                      <SortIcon field="round_number" />
                    </Button>
                  </TableHead>
                  <TableHead className="text-right">Battus</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAndSortedData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Aucun résultat trouvé
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAndSortedData.map((item) => (
                    <Collapsible key={item.coureur_id} asChild open={expandedRows.has(item.coureur_id)}>
                      <>
                        <TableRow className="hover:bg-muted/50 transition-colors">
                          <TableCell>
                            <CollapsibleTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0"
                                onClick={() => toggleRow(item.coureur_id)}
                                disabled={item.concurrents_battus.length === 0}
                              >
                                {item.concurrents_battus.length > 0 && (
                                  <ChevronDown
                                    className={`h-4 w-4 transition-transform ${
                                      expandedRows.has(item.coureur_id) ? "rotate-180" : ""
                                    }`}
                                  />
                                )}
                              </Button>
                            </CollapsibleTrigger>
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">{item.coureur_nom}</div>
                              <div className="text-xs text-muted-foreground">{item.coureur_equipe}</div>
                            </div>
                          </TableCell>
                  <TableCell className="font-mono">{item.cote_initiale}</TableCell>
                  <TableCell className="font-mono font-semibold">{item.winning_amount}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{item.winning_manager}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">R{item.round_number}</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge variant="secondary" className="bg-primary/10">
                              {item.concurrents_battus.length}
                            </Badge>
                          </TableCell>
                        </TableRow>
                        {item.concurrents_battus.length > 0 && (
                          <CollapsibleContent asChild>
                            <TableRow className="bg-muted/30">
                              <TableCell colSpan={8} className="p-0">
                                <div className="px-12 py-3 space-y-2">
                                  <div className="text-xs font-semibold text-muted-foreground mb-2">
                                    Concurrents battus:
                                  </div>
                                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                                    {item.concurrents_battus.map((concurrent, idx) => (
                                      <div
                                        key={idx}
                                        className="flex items-center justify-between p-2 rounded-md bg-background border border-border"
                                      >
                                        <span className="text-sm">{concurrent.manager_nom}</span>
                                        <div className="flex items-center gap-2">
                                          <span className="text-sm font-mono">{concurrent.my_bid}</span>
                                          <span className="text-xs text-muted-foreground">
                                            ({(concurrent.my_bid - item.winning_amount).toFixed(0)})
                                          </span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </TableCell>
                            </TableRow>
                          </CollapsibleContent>
                        )}
                      </>
                    </Collapsible>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
