import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
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
import { Search, ArrowLeft, LogOut, ArrowUpDown, ArrowUp, ArrowDown, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";
import mpcLogo from "@/assets/mpc-logo.png";
import { format, differenceInDays, parseISO } from "date-fns";
import { fr } from "date-fns/locale";

interface CourseWithPoints {
  course_id: string;
  nom: string;
  categorie: string | null;
  date_debut: string | null;
  date_fin: string | null;
  phase_id: string | null;
  phase_index: number | null;
  saison_id: string | null;
  saison_annee: number | null;
  total_points: number;
}

type SortColumn = 'nom' | 'categorie' | 'days_until' | 'date_debut' | 'date_fin' | 'phase' | 'points';

export default function CalendarPage() {
  const navigate = useNavigate();
  
  // Local season state
  const [localSelectedSeason, setLocalSelectedSeason] = useState<{ id: string; annee: number } | null>(null);
  
  // Filters
  const [search, setSearch] = useState("");
  const [selectedCategorie, setSelectedCategorie] = useState<string>("all");
  const [selectedPhase, setSelectedPhase] = useState<string>("all");
  
  // Sorting state
  const [sortColumn, setSortColumn] = useState<SortColumn | null>('date_debut');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Fetch all seasons
  const { data: allSeasons } = useQuery({
    queryKey: ["all-seasons-calendar"],
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

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  // Fetch phases for the selected season
  const { data: phasesData } = useQuery({
    queryKey: ["phases-calendar", localSelectedSeason?.id],
    queryFn: async () => {
      if (!localSelectedSeason?.id) return [];
      const { data, error } = await supabase
        .from("phases")
        .select("id, index_dans_saison")
        .eq("saison_id", localSelectedSeason.id)
        .order("index_dans_saison");
      if (error) throw error;
      return data || [];
    },
    enabled: !!localSelectedSeason?.id,
  });

  // Fetch courses with theoretical points for selected season
  const { data: coursesData, isLoading } = useQuery({
    queryKey: ["calendar-courses", localSelectedSeason?.id],
    queryFn: async () => {
      if (!localSelectedSeason?.id) return [];

      // Get all phases for this season
      const { data: phases, error: phasesError } = await supabase
        .from("phases")
        .select("id, index_dans_saison, saison_id")
        .eq("saison_id", localSelectedSeason.id);
      
      if (phasesError) throw phasesError;
      
      const phaseIds = phases?.map(p => p.id) || [];
      if (phaseIds.length === 0) return [];

      // Get courses with theoretical points from the view
      const { data: coursesWithPoints, error: coursesError } = await supabase
        .from("v_course_points_theoriques")
        .select("course_id, nom, categorie, date_debut, date_fin, phase_id, phase_index, points_total")
        .in("phase_id", phaseIds)
        .order("date_debut", { ascending: true });

      if (coursesError) throw coursesError;

      // Build final data
      const result: CourseWithPoints[] = (coursesWithPoints || []).map(course => ({
        course_id: course.course_id || '',
        nom: course.nom || '',
        categorie: course.categorie,
        date_debut: course.date_debut,
        date_fin: course.date_fin,
        phase_id: course.phase_id,
        phase_index: course.phase_index,
        saison_id: localSelectedSeason.id,
        saison_annee: localSelectedSeason.annee,
        total_points: course.points_total || 0,
      }));

      return result;
    },
    enabled: !!localSelectedSeason?.id,
  });

  // Get unique categories for filter
  const categorieOptions = useMemo(() => {
    if (!coursesData) return [];
    const categories = [...new Set(coursesData.map(c => c.categorie).filter(Boolean))] as string[];
    return categories.sort();
  }, [coursesData]);

  // Filter courses
  const filteredCourses = useMemo(() => {
    if (!coursesData) return [];

    return coursesData.filter(course => {
      // Text search
      if (search && !course.nom.toLowerCase().includes(search.toLowerCase())) {
        return false;
      }
      // Category filter
      if (selectedCategorie !== "all" && course.categorie !== selectedCategorie) {
        return false;
      }
      // Phase filter
      if (selectedPhase !== "all" && course.phase_id !== selectedPhase) {
        return false;
      }
      return true;
    });
  }, [coursesData, search, selectedCategorie, selectedPhase]);

  // Sort handlers
  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      if (sortDirection === 'desc') {
        setSortDirection('asc');
      } else if (sortDirection === 'asc') {
        setSortColumn(null);
      }
    } else {
      setSortColumn(column);
      setSortDirection('desc');
    }
  };

  const getSortIcon = (column: SortColumn) => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="h-4 w-4 ml-1 inline opacity-50" />;
    }
    return sortDirection === 'desc' 
      ? <ArrowDown className="h-4 w-4 ml-1 inline" />
      : <ArrowUp className="h-4 w-4 ml-1 inline" />;
  };

  // Calculate days until start
  const getDaysUntil = (dateDebut: string | null): number | null => {
    if (!dateDebut) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startDate = parseISO(dateDebut);
    return differenceInDays(startDate, today);
  };

  // Sort courses
  const sortedCourses = useMemo(() => {
    if (!sortColumn) return filteredCourses;
    
    return [...filteredCourses].sort((a, b) => {
      let valueA: any;
      let valueB: any;
      
      switch (sortColumn) {
        case 'nom':
          valueA = a.nom.toLowerCase();
          valueB = b.nom.toLowerCase();
          break;
        case 'categorie':
          valueA = a.categorie || '';
          valueB = b.categorie || '';
          break;
        case 'days_until':
          valueA = getDaysUntil(a.date_debut) ?? Infinity;
          valueB = getDaysUntil(b.date_debut) ?? Infinity;
          break;
        case 'date_debut':
          valueA = a.date_debut || '';
          valueB = b.date_debut || '';
          break;
        case 'date_fin':
          valueA = a.date_fin || '';
          valueB = b.date_fin || '';
          break;
        case 'phase':
          valueA = a.phase_index ?? Infinity;
          valueB = b.phase_index ?? Infinity;
          break;
        case 'points':
          valueA = a.total_points;
          valueB = b.total_points;
          break;
        default:
          return 0;
      }
      
      if (valueA < valueB) return sortDirection === 'asc' ? -1 : 1;
      if (valueA > valueB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredCourses, sortColumn, sortDirection]);

  const resetFilters = () => {
    setSearch("");
    setSelectedCategorie("all");
    setSelectedPhase("all");
  };

  // Format date
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    return format(parseISO(dateStr), "dd MMM yyyy", { locale: fr });
  };

  // Days until badge
  const getDaysUntilBadge = (dateDebut: string | null) => {
    const days = getDaysUntil(dateDebut);
    if (days === null) return <span className="text-muted-foreground">-</span>;
    
    if (days < 0) {
      return <Badge variant="secondary">Passée</Badge>;
    } else if (days === 0) {
      return <Badge className="bg-green-500 hover:bg-green-600">Aujourd'hui</Badge>;
    } else if (days <= 7) {
      return <Badge className="bg-yellow-500 hover:bg-yellow-600 text-black">J-{days}</Badge>;
    } else if (days <= 30) {
      return <Badge variant="outline">J-{days}</Badge>;
    } else {
      return <span className="text-muted-foreground">J-{days}</span>;
    }
  };

  if (!localSelectedSeason) {
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-50 bg-black/95 backdrop-blur-sm border-b border-yellow-500/30">
          <div className="container mx-auto px-4 py-3 md:py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard/home')}>
                <ArrowLeft className="h-5 w-5 text-white" />
              </Button>
              <img src={mpcLogo} alt="Logo" className="h-8 w-8 md:h-10 md:w-10" />
              <h1 className="font-montserrat font-bold text-white text-sm md:text-xl">Calendrier</h1>
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
            <h1 className="font-montserrat font-bold text-white text-sm md:text-xl">Calendrier</h1>
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
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="space-y-1.5">
            <Label htmlFor="search">Rechercher</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="search"
                placeholder="Nom de la course..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
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
            <Label>Phase</Label>
            <Select value={selectedPhase} onValueChange={setSelectedPhase}>
              <SelectTrigger>
                <SelectValue placeholder="Toutes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les phases</SelectItem>
                {phasesData?.map((phase) => (
                  <SelectItem key={phase.id} value={phase.id}>
                    Phase {phase.index_dans_saison}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-end">
            <Button variant="outline" onClick={resetFilters} className="w-full">
              Réinitialiser
            </Button>
          </div>
        </div>

        {/* Results count */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-muted-foreground">
            {sortedCourses.length} course{sortedCourses.length !== 1 ? 's' : ''} trouvée{sortedCourses.length !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 10 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort('nom')}
                  >
                    Nom {getSortIcon('nom')}
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort('categorie')}
                  >
                    Catégorie {getSortIcon('categorie')}
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50 text-center"
                    onClick={() => handleSort('days_until')}
                  >
                    Compte à rebours {getSortIcon('days_until')}
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort('date_debut')}
                  >
                    Date début {getSortIcon('date_debut')}
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort('date_fin')}
                  >
                    Date fin {getSortIcon('date_fin')}
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50 text-center"
                    onClick={() => handleSort('phase')}
                  >
                    Phase {getSortIcon('phase')}
                  </TableHead>
                  <TableHead className="text-center">Saison</TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50 text-right"
                    onClick={() => handleSort('points')}
                  >
                    Points {getSortIcon('points')}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedCourses.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      Aucune course trouvée
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedCourses.map((course) => (
                    <TableRow key={course.course_id}>
                      <TableCell className="font-medium">{course.nom}</TableCell>
                      <TableCell>
                        {course.categorie ? (
                          <Badge variant="outline">{course.categorie}</Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {getDaysUntilBadge(course.date_debut)}
                      </TableCell>
                      <TableCell>{formatDate(course.date_debut)}</TableCell>
                      <TableCell>{formatDate(course.date_fin)}</TableCell>
                      <TableCell className="text-center">
                        {course.phase_index !== null ? (
                          <Badge variant="secondary">P{course.phase_index}</Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {course.saison_annee || "-"}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {course.total_points > 0 ? (
                          <span className="font-semibold text-primary">{course.total_points.toLocaleString()}</span>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
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
