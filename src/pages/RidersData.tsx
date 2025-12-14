import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSeasonContext } from "@/contexts/SeasonContext";
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
import { Star, Search, Database, ArrowLeft, LogOut } from "lucide-react";
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

export default function RidersData() {
  const { selectedSeason, seasons, setSelectedSeason } = useSeasonContext();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  
  // Manager state
  const [managerId, setManagerId] = useState<string | null>(null);
  
  // Filters
  const [search, setSearch] = useState("");
  const [selectedEquipe, setSelectedEquipe] = useState<string>("all");
  const [selectedCategorie, setSelectedCategorie] = useState<string>("all");
  const [selectedCotes, setSelectedCotes] = useState<number[]>([]);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

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

  // Fetch riders with points for selected season
  const { data: ridersData, isLoading: ridersLoading } = useQuery({
    queryKey: ["riders-data", selectedSeason?.id, managerId],
    queryFn: async () => {
      if (!selectedSeason?.id) return [];

      // Get riders for the season with their team info
      const { data: coureursData, error: coureursError } = await supabase
        .from("coureurs_saisons")
        .select(`
          coureur_id,
          prix_initial,
          saison_id,
          equipe_id,
          coureurs!inner(nom)
        `)
        .eq("saison_id", selectedSeason.id)
        .eq("actif", true)
        .limit(5000);

      if (coureursError) throw coureursError;

      // Get equipes_saisons for trigrammes and categories
      const { data: equipesData } = await supabase
        .from("equipes_saisons")
        .select("id, equipe_id, trigramme, nom_affiche, categorie")
        .eq("saison_id", selectedSeason.id);

      const equipeMap = new Map<string, { nom: string; categorie: string | null }>();
      equipesData?.forEach(eq => {
        equipeMap.set(eq.equipe_id, { nom: eq.nom_affiche, categorie: eq.categorie });
      });

      // Get points for these riders in this season
      const { data: pointsData, error: pointsError } = await supabase
        .from("points_ledger")
        .select(`
          coureur_id,
          points,
          phases!inner(saison_id)
        `)
        .eq("phases.saison_id", selectedSeason.id)
        .limit(50000);

      if (pointsError) throw pointsError;

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

      // Aggregate points by rider
      const pointsMap = new Map<string, number>();
      pointsData?.forEach(p => {
        const current = pointsMap.get(p.coureur_id) || 0;
        pointsMap.set(p.coureur_id, current + p.points);
      });

      // Combine data
      const riders: RiderWithPoints[] = (coureursData || []).map((cs: any) => {
        const equipeInfo = equipeMap.get(cs.equipe_id);
        return {
          coureur_id: cs.coureur_id,
          coureur_nom: cs.coureurs?.nom || cs.coureur_id,
          equipe_trigramme: equipeInfo?.nom || null,
          equipe_id: cs.equipe_id,
          equipe_categorie: equipeInfo?.categorie || null,
          prix_initial: cs.prix_initial,
          saison_id: cs.saison_id,
          saison_annee: selectedSeason.annee,
          total_points: pointsMap.get(cs.coureur_id) || 0,
          is_favorite: favoritesSet.has(cs.coureur_id),
        };
      });

      return riders.sort((a, b) => b.total_points - a.total_points);
    },
    enabled: !!selectedSeason?.id,
  });

  // Fetch teams for filter
  const { data: teamsData } = useQuery({
    queryKey: ["teams-filter", selectedSeason?.id],
    queryFn: async () => {
      if (!selectedSeason?.id) return [];
      
      const { data, error } = await supabase
        .from("equipes_saisons")
        .select("id, equipe_id, nom_affiche, categorie")
        .eq("saison_id", selectedSeason.id)
        .eq("actif", true)
        .order("nom_affiche");
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedSeason?.id,
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
      return true;
    });
  }, [ridersData, search, selectedEquipe, selectedCategorie, selectedCotes, showFavoritesOnly]);

  if (!selectedSeason) {
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
            Veuillez sélectionner une saison
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
              value={selectedSeason?.id || ""}
              onValueChange={(value) => {
                const season = seasons.find(s => s.id === value);
                if (season) setSelectedSeason(season);
              }}
            >
              <SelectTrigger className="w-[100px] md:w-[140px] border-yellow-500/50 bg-black/80 text-white">
                <SelectValue placeholder="Saison" />
              </SelectTrigger>
              <SelectContent className="bg-popover">
                {seasons.map((s) => (
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
                <TableHead>Catégorie</TableHead>
                <TableHead className="text-right">Cote</TableHead>
                <TableHead className="text-right">Points</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRiders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Aucun coureur trouvé
                  </TableCell>
                </TableRow>
              ) : (
                filteredRiders.map((rider) => (
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
                    <TableCell>{rider.equipe_categorie || "-"}</TableCell>
                    <TableCell className="text-right">{rider.prix_initial}</TableCell>
                    <TableCell className="text-right font-semibold">
                      {rider.total_points}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}
      </div>
    </div>
  );
}
