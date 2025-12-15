import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Star, Search, Database, ArrowLeft, LogOut, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import mpcLogo from "@/assets/mpc-logo.png";

interface RiderWithPoints {
  coureur_id: string;
  coureur_nom: string;
  equipe_trigramme: string | null;
  equipe_id: string;
  equipe_categorie: string | null;
  prix_initial: number;
  saison_id: string;
  saison_annee: number;
  total_points: number;
  is_favorite: boolean;
}

interface UpcomingRace {
  race_id: string;
  race_nom: string;
  date_debut: string;
  is_confirmed: boolean;
}

export default function RidersData() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  
  // Local season state (autonomous from global context)
  const [localSelectedSeason, setLocalSelectedSeason] = useState<{ id: string; annee: number } | null>(null);
  
  // Manager state
  const [managerId, setManagerId] = useState<string | null>(null);
  
  // Filters
  const [search, setSearch] = useState("");
  const [selectedEquipe, setSelectedEquipe] = useState<string>("all");
  const [selectedCategorie, setSelectedCategorie] = useState<string>("all");
  const [selectedCotes, setSelectedCotes] = useState<number[]>([]);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [programFilter, setProgramFilter] = useState<"all" | "with" | "without">("all");
  
  // Sorting state
  const [sortColumn, setSortColumn] = useState<'cote' | 'points' | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Fetch all seasons directly (autonomous from context)
  const { data: allSeasons } = useQuery({
    queryKey: ["all-seasons-data-page"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("saisons")
        .select("id, annee")
        .order("annee", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Initialize local season with the most recent one
  useEffect(() => {
    if (allSeasons && allSeasons.length > 0 && !localSelectedSeason) {
      setLocalSelectedSeason(allSeasons[0]);
    }
  }, [allSeasons, localSelectedSeason]);

  // Get current manager
  useEffect(() => {
    const fetchManager = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id) {
        const { data: manager } = await supabase
          .from("managers")
          .select("id")
          .eq("user_id", session.user.id)
          .single();
        if (manager) setManagerId(manager.id);
      }
    };
    fetchManager();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  // Fetch riders with points for selected season using RPC (bypasses row limits)
  const { data: ridersData, isLoading: ridersLoading } = useQuery({
    queryKey: ["riders-data", localSelectedSeason?.id, managerId],
    queryFn: async () => {
      if (!localSelectedSeason?.id) return [];

      // Use RPC function to get ALL riders without row limits
      const { data: rpcData, error: rpcError } = await supabase
        .rpc("get_riders_data_for_season", { p_saison_id: localSelectedSeason.id });

      if (rpcError) throw rpcError;

      // Get user's favorites
      let favoritesSet = new Set<string>();
      if (managerId) {
        const { data: favorites } = await supabase
          .from("rider_favorites")
          .select("coureur_id")
          .eq("manager_id", managerId);
        
        if (favorites) {
          favoritesSet = new Set(favorites.map(f => f.coureur_id));
        }
      }

      // Map RPC result to RiderWithPoints
      const riders: RiderWithPoints[] = (rpcData || []).map((r: any) => ({
        coureur_id: r.coureur_id,
        coureur_nom: r.coureur_nom,
        equipe_trigramme: r.equipe_nom || null,
        equipe_id: r.equipe_id,
        equipe_categorie: r.equipe_categorie || null,
        prix_initial: r.prix_initial,
        saison_id: r.saison_id,
        saison_annee: localSelectedSeason.annee,
        total_points: Number(r.total_points) || 0,
        is_favorite: favoritesSet.has(r.coureur_id),
      }));

      return riders;
    },
    enabled: !!localSelectedSeason?.id,
  });

  // Fetch upcoming races program from startlists
  const { data: programData } = useQuery({
    queryKey: ["riders-program", localSelectedSeason?.id],
    queryFn: async () => {
      if (!localSelectedSeason?.id) return new Map<string, UpcomingRace[]>();

      const today = new Date().toISOString().split('T')[0];

      // Get startlist entries with upcoming races for this season
      const { data: entries, error } = await supabase
        .from("startlist_entries")
        .select(
          `
          coureur_id,
          startlist_imports!inner(
            pcs_validated,
            created_at,
            saison_id,
            courses!inner(
              id,
              nom,
              date_debut
            )
          )
        `
        )
        .eq("startlist_imports.saison_id", localSelectedSeason.id)
        .gte("startlist_imports.courses.date_debut", today)
        .not("coureur_id", "is", null);

      if (error) throw error;

      // Build a map of coureur_id -> races (keeping only latest import per race)
      const riderRacesMap = new Map<string, Map<string, { race: UpcomingRace; created_at: string }>>();

      entries?.forEach((entry: any) => {
        if (!entry.coureur_id || !entry.startlist_imports?.courses) return;
        
        const coureurId = entry.coureur_id;
        const course = entry.startlist_imports.courses;
        const raceId = course.id;
        const createdAt = entry.startlist_imports.created_at;

        if (!riderRacesMap.has(coureurId)) {
          riderRacesMap.set(coureurId, new Map());
        }

        const riderMap = riderRacesMap.get(coureurId)!;
        const existing = riderMap.get(raceId);

        // Keep only the most recent import for each race
        if (!existing || new Date(createdAt) > new Date(existing.created_at)) {
          riderMap.set(raceId, {
            race: {
              race_id: raceId,
              race_nom: course.nom,
              date_debut: course.date_debut,
              is_confirmed: entry.startlist_imports.pcs_validated || false,
            },
            created_at: createdAt,
          });
        }
      });

      // Convert to final map with sorted races
      const resultMap = new Map<string, UpcomingRace[]>();
      riderRacesMap.forEach((racesMap, coureurId) => {
        const races = Array.from(racesMap.values())
          .map(r => r.race)
          .sort((a, b) => new Date(a.date_debut).getTime() - new Date(b.date_debut).getTime());
        resultMap.set(coureurId, races);
      });

      return resultMap;
    },
    enabled: !!localSelectedSeason?.id,
  });

  // Fetch teams for filter
  const { data: teamsData } = useQuery({
    queryKey: ["teams-filter", localSelectedSeason?.id],
    queryFn: async () => {
      if (!localSelectedSeason?.id) return [];
      
      const { data, error } = await supabase
        .from("equipes_saisons")
        .select("id, equipe_id, nom_affiche, categorie")
        .eq("saison_id", localSelectedSeason.id)
        .eq("actif", true)
        .order("nom_affiche");
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!localSelectedSeason?.id,
  });

  // Filtered teams based on selected category
  const filteredTeamsData = useMemo(() => {
    if (!teamsData) return [];
    if (selectedCategorie === "all") return teamsData;
    return teamsData.filter(team => team.categorie === selectedCategorie);
  }, [teamsData, selectedCategorie]);

  // Reset team filter when category changes and team is no longer valid
  useEffect(() => {
    if (selectedEquipe !== "all" && filteredTeamsData.length > 0) {
      const teamStillValid = filteredTeamsData.some(t => t.equipe_id === selectedEquipe);
      if (!teamStillValid) {
        setSelectedEquipe("all");
      }
    }
  }, [selectedCategorie, filteredTeamsData, selectedEquipe]);

  // Toggle favorite mutation
  const toggleFavorite = useMutation({
    mutationFn: async ({ coureurId, isFavorite }: { coureurId: string; isFavorite: boolean }) => {
      if (!managerId) throw new Error("Not logged in");

      if (isFavorite) {
        // Remove favorite
        const { error } = await supabase
          .from("rider_favorites")
          .delete()
          .eq("manager_id", managerId)
          .eq("coureur_id", coureurId);
        if (error) throw error;
      } else {
        // Add favorite
        const { error } = await supabase
          .from("rider_favorites")
          .insert({ manager_id: managerId, coureur_id: coureurId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["riders-data"] });
    },
    onError: (error) => {
      toast.error("Erreur lors de la mise à jour des favoris");
      console.error(error);
    },
  });

  // Get unique cotes for filter
  const coteOptions = useMemo(() => {
    if (!ridersData) return [];
    const cotes = [...new Set(ridersData.map(r => r.prix_initial))].sort((a, b) => b - a);
    return cotes;
  }, [ridersData]);

  // Get unique categories for filter
  const categorieOptions = useMemo(() => {
    if (!ridersData) return [];
    const categories = [...new Set(ridersData.map(r => r.equipe_categorie).filter(Boolean))] as string[];
    return categories.sort();
  }, [ridersData]);

  // Filter riders
  const filteredRiders = useMemo(() => {
    if (!ridersData) return [];

    return ridersData.filter(rider => {
      // Text search
      if (search && !rider.coureur_nom.toLowerCase().includes(search.toLowerCase())) {
        return false;
      }
      // Team filter
      if (selectedEquipe !== "all" && rider.equipe_id !== selectedEquipe) {
        return false;
      }
      // Category filter
      if (selectedCategorie !== "all" && rider.equipe_categorie !== selectedCategorie) {
        return false;
      }
      // Cote filter (multi-select)
      if (selectedCotes.length > 0 && !selectedCotes.includes(rider.prix_initial)) {
        return false;
      }
      // Favorites filter
      if (showFavoritesOnly && !rider.is_favorite) {
        return false;
      }
      // Program filter
      if (programFilter !== "all") {
        const hasProgram = programData?.has(rider.coureur_id) && (programData.get(rider.coureur_id)?.length || 0) > 0;
        if (programFilter === "with" && !hasProgram) return false;
        if (programFilter === "without" && hasProgram) return false;
      }
      return true;
    });
  }, [ridersData, search, selectedEquipe, selectedCategorie, selectedCotes, showFavoritesOnly, programFilter, programData]);

  // Sort handlers
  const handleSort = (column: 'cote' | 'points') => {
    if (sortColumn === column) {
      if (sortDirection === 'desc') {
        setSortDirection('asc');
      } else {
        setSortColumn(null);
      }
    } else {
      setSortColumn(column);
      setSortDirection('desc');
    }
  };

  const getSortIcon = (column: 'cote' | 'points') => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="h-4 w-4 ml-1 inline opacity-50" />;
    }
    return sortDirection === 'desc' 
      ? <ArrowDown className="h-4 w-4 ml-1 inline" />
      : <ArrowUp className="h-4 w-4 ml-1 inline" />;
  };

  // Sort filtered riders
  const sortedRiders = useMemo(() => {
    if (!sortColumn) return filteredRiders;
    
    return [...filteredRiders].sort((a, b) => {
      const valueA = sortColumn === 'cote' ? a.prix_initial : a.total_points;
      const valueB = sortColumn === 'cote' ? b.prix_initial : b.total_points;
      
      return sortDirection === 'desc' ? valueB - valueA : valueA - valueB;
    });
  }, [filteredRiders, sortColumn, sortDirection]);

  if (!localSelectedSeason) {
    return (
      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="sticky top-0 z-50 bg-black/95 backdrop-blur-sm border-b border-yellow-500/30">
          <div className="container mx-auto px-4 py-3 md:py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard/home')}>
                <ArrowLeft className="h-5 w-5 text-white" />
              </Button>
              <img src={mpcLogo} alt="Logo" className="h-8 w-8 md:h-10 md:w-10" />
              <h1 className="font-montserrat font-bold text-white text-sm md:text-xl">Données Coureurs</h1>
            </div>
            <Button variant="ghost" size="icon" onClick={handleSignOut}>
              <LogOut className="h-5 w-5 text-white" />
            </Button>
          </div>
        </header>
        <div className="container mx-auto px-4 py-8">
          <div className="text-center py-12 text-muted-foreground">
            Chargement des saisons...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-black/95 backdrop-blur-sm border-b border-yellow-500/30">
        <div className="container mx-auto px-4 py-3 md:py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard/home')}>
              <ArrowLeft className="h-5 w-5 text-white" />
            </Button>
            <img src={mpcLogo} alt="Logo" className="h-8 w-8 md:h-10 md:w-10" />
            <h1 className="font-montserrat font-bold text-white text-sm md:text-xl">Données Coureurs</h1>
          </div>
          <div className="flex items-center gap-2">
            <Select
              value={localSelectedSeason?.id || ""}
              onValueChange={(value) => {
                const season = allSeasons?.find(s => s.id === value);
                if (season) setLocalSelectedSeason(season);
              }}
            >
              <SelectTrigger className="w-[100px] md:w-[140px] border-yellow-500/50 bg-black/80 text-white">
                <SelectValue placeholder="Saison" />
              </SelectTrigger>
              <SelectContent className="bg-popover">
                {allSeasons?.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.annee}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="ghost" size="icon" onClick={handleSignOut}>
              <LogOut className="h-5 w-5 text-white" />
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
        <div className="space-y-1.5">
          <Label htmlFor="search">Rechercher</Label>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              id="search"
              placeholder="Nom du coureur..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Équipe</Label>
          <Select value={selectedEquipe} onValueChange={setSelectedEquipe}>
            <SelectTrigger>
              <SelectValue placeholder="Toutes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les équipes</SelectItem>
              {filteredTeamsData?.map((team) => (
                <SelectItem key={team.id} value={team.equipe_id}>
                  {team.nom_affiche}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Catégorie</Label>
          <Select value={selectedCategorie} onValueChange={setSelectedCategorie}>
            <SelectTrigger>
              <SelectValue placeholder="Toutes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les catégories</SelectItem>
              {categorieOptions.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Cotes {selectedCotes.length > 0 && `(${selectedCotes.length})`}</Label>
          <div className="border rounded-md p-2 max-h-32 overflow-y-auto space-y-1">
            {coteOptions.map((cote) => (
              <div key={cote} className="flex items-center space-x-2">
                <Checkbox
                  id={`cote-${cote}`}
                  checked={selectedCotes.includes(cote)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setSelectedCotes([...selectedCotes, cote]);
                    } else {
                      setSelectedCotes(selectedCotes.filter(c => c !== cote));
                    }
                  }}
                />
                <Label htmlFor={`cote-${cote}`} className="cursor-pointer text-sm">
                  {cote}
                </Label>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Programme</Label>
          <Select value={programFilter} onValueChange={(v) => setProgramFilter(v as "all" | "with" | "without")}>
            <SelectTrigger>
              <SelectValue placeholder="Tous" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous</SelectItem>
              <SelectItem value="with">Avec programme</SelectItem>
              <SelectItem value="without">Sans programme</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-end pb-1">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="favorites"
              checked={showFavoritesOnly}
              onCheckedChange={(checked) => setShowFavoritesOnly(checked === true)}
            />
            <Label htmlFor="favorites" className="cursor-pointer">
              Favoris uniquement
            </Label>
          </div>
        </div>

        <div className="flex items-end">
          <Button
            variant="outline"
            onClick={() => {
              setSearch("");
              setSelectedEquipe("all");
              setSelectedCategorie("all");
              setSelectedCotes([]);
              setShowFavoritesOnly(false);
              setProgramFilter("all");
            }}
          >
            Réinitialiser
          </Button>
        </div>
      </div>

      {/* Results count */}
      <div className="text-sm text-muted-foreground mb-4">
        {filteredRiders.length} coureur{filteredRiders.length > 1 ? "s" : ""} affiché{filteredRiders.length > 1 ? "s" : ""}
        {ridersData && filteredRiders.length !== ridersData.length && (
          <span> sur {ridersData.length} total</span>
        )}
      </div>

      {/* Table */}
      {ridersLoading ? (
        <div className="space-y-2">
          {[...Array(10)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">Fav</TableHead>
                <TableHead>Nom</TableHead>
                <TableHead>Équipe</TableHead>
                <TableHead className="w-20">Catégorie</TableHead>
                <TableHead 
                  className="w-16 text-right cursor-pointer hover:bg-muted/50 select-none"
                  onClick={() => handleSort('cote')}
                >
                  Cote {getSortIcon('cote')}
                </TableHead>
                <TableHead 
                  className="w-20 text-right cursor-pointer hover:bg-muted/50 select-none"
                  onClick={() => handleSort('points')}
                >
                  Points {getSortIcon('points')}
                </TableHead>
                <TableHead className="min-w-[300px]">Programme</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedRiders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Aucun coureur trouvé
                  </TableCell>
                </TableRow>
              ) : (
                sortedRiders.map((rider) => {
                  const upcomingRaces = programData?.get(rider.coureur_id) || [];
                  return (
                    <TableRow key={rider.coureur_id}>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => toggleFavorite.mutate({
                            coureurId: rider.coureur_id,
                            isFavorite: rider.is_favorite,
                          })}
                          disabled={!managerId}
                        >
                          <Star
                            className={`h-4 w-4 ${
                              rider.is_favorite
                                ? "fill-yellow-400 text-yellow-400"
                                : "text-muted-foreground"
                            }`}
                          />
                        </Button>
                      </TableCell>
                      <TableCell className="font-medium">{rider.coureur_nom}</TableCell>
                      <TableCell>{rider.equipe_trigramme || "-"}</TableCell>
                      <TableCell className="w-20">{rider.equipe_categorie || "-"}</TableCell>
                      <TableCell className="w-16 text-right">{rider.prix_initial}</TableCell>
                      <TableCell className="w-20 text-right font-semibold">
                        {rider.total_points}
                      </TableCell>
                      <TableCell className="min-w-[300px]">
                        {upcomingRaces.length === 0 ? (
                          <span className="text-muted-foreground text-sm">-</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {upcomingRaces.map((race) => (
                              <Badge 
                                key={race.race_id} 
                                variant="outline"
                                className={`text-xs ${race.is_confirmed ? "border-green-500/50" : "border-yellow-500/50"}`}
                              >
                                <span className={race.is_confirmed ? "text-green-500" : "text-yellow-500"}>
                                  {race.is_confirmed ? "✓" : "?"}
                                </span>
                                <span className="ml-1 truncate max-w-[120px]">{race.race_nom}</span>
                              </Badge>
                            ))}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      )}
      </div>
    </div>
  );
}
