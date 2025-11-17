import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Download, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { Card, CardContent } from "@/components/ui/card";
import type { Database } from "@/integrations/supabase/types";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const PAGE_SIZE = 50;

const TYPE_CLASSEMENT_OPTIONS = [
  { value: "all", label: "Tous types" },
  { value: "General", label: "Général" },
  { value: "Etape", label: "Étape" },
  { value: "Points", label: "Points" },
  { value: "Montagne", label: "Montagne" },
  { value: "Jeune", label: "Jeune" },
  { value: "PorteurMaillot", label: "Porteur Maillot" },
];

const STATUT_OPTIONS = [
  { value: "all", label: "Tous statuts" },
  { value: "finished", label: "Classé" },
  { value: "dnf", label: "DNF" },
  { value: "dns", label: "DNS" },
  { value: "dsq", label: "DSQ" },
  { value: "otl", label: "OTL" },
  { value: "abandoned", label: "Abandon" },
];

type ResultStatut = Database["public"]["Enums"]["result_statut"];
type TypeClassement = Database["public"]["Enums"]["type_classement"];

const getStatutBadgeVariant = (statut: ResultStatut | null) => {
  switch (statut) {
    case "finished":
      return "default";
    case "dnf":
    case "dns":
    case "dsq":
      return "destructive";
    default:
      return "secondary";
  }
};

const getTypeBadgeVariant = (type: TypeClassement | null) => {
  switch (type) {
    case "General":
      return "default";
    case "Etape":
      return "secondary";
    case "Points":
      return "outline";
    default:
      return "secondary";
  }
};

export const RaceResultsTable = () => {
  const isMobile = useIsMobile();
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [courseFilter, setCourseFilter] = useState("all");
  const [saisonFilter, setSaisonFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statutFilter, setStatutFilter] = useState("all");
  const [etapeFilter, setEtapeFilter] = useState("");
  const [sortColumn, setSortColumn] = useState("date_classement");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const debouncedSearch = useDebouncedValue(search, 500);

  // Fetch saisons for filter
  const { data: saisons } = useQuery({
    queryKey: ["saisons-for-filter"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("saisons")
        .select("id, annee")
        .order("annee", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch courses for filter
  const { data: courses } = useQuery({
    queryKey: ["courses-for-filter", saisonFilter],
    queryFn: async () => {
      let query = supabase
        .from("courses")
        .select("id, nom, phase_id, phases(saison_id)")
        .order("nom");
      
      if (saisonFilter !== "all") {
        query = query.eq("phases.saison_id", saisonFilter);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // Fetch race results
  const { data: results, isLoading } = useQuery({
    queryKey: [
      "race-results-table",
      page,
      debouncedSearch,
      courseFilter,
      saisonFilter,
      typeFilter,
      statutFilter,
      etapeFilter,
      sortColumn,
      sortDirection,
    ],
    queryFn: async () => {
      // First, get course_ids if saison filter is applied
      let courseIds: string[] | null = null;
      if (saisonFilter !== "all") {
        const { data: coursesData } = await supabase
          .from("courses")
          .select("id, phases!inner(saison_id)")
          .eq("phases.saison_id", saisonFilter);
        
        courseIds = coursesData?.map(c => c.id) || [];
        if (courseIds.length === 0) {
          return { data: [], count: 0 };
        }
      }

      let query = supabase
        .from("v_race_results_editable")
        .select("*", { count: "exact" });

      // Apply filters
      if (debouncedSearch) {
        query = query.or(
          `coureur_nom.ilike.%${debouncedSearch}%,course_id.ilike.%${debouncedSearch}%`
        );
      }
      if (courseIds) {
        query = query.in("course_id", courseIds);
      }
      if (courseFilter !== "all") {
        query = query.eq("course_id", courseFilter);
      }
      if (typeFilter !== "all") {
        query = query.eq("type_classement", typeFilter as TypeClassement);
      }
      if (statutFilter !== "all") {
        query = query.eq("statut", statutFilter as ResultStatut);
      }
      if (etapeFilter) {
        query = query.eq("etape_numero", parseInt(etapeFilter));
      }

      // Apply sorting
      query = query.order(sortColumn, { ascending: sortDirection === "asc" });

      // Apply pagination
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;
      if (error) throw error;

      return { data: data || [], count: count || 0 };
    },
  });

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const exportToCSV = () => {
    if (!results?.data.length) return;

    const headers = [
      "Course",
      "Date",
      "Type",
      "Étape",
      "Position",
      "Coureur",
      "Équipe",
      "Manager",
      "Statut",
      "Points",
    ];

    const rows = results.data.map((r) => [
      r.course_id || "",
      r.date_classement || "",
      r.type_classement || "",
      r.etape_numero || "",
      r.position || "",
      r.coureur_nom || "",
      r.coureur_equipe || "",
      r.manager_nom || "",
      r.statut || "",
      r.points || 0,
    ]);

    const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `race_results_${new Date().toISOString()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalPages = Math.ceil((results?.count || 0) / PAGE_SIZE);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Base de données des résultats</h2>
          <p className="text-sm text-muted-foreground">
            Affichage de {page * PAGE_SIZE + 1} à{" "}
            {Math.min((page + 1) * PAGE_SIZE, results?.count || 0)} sur{" "}
            {results?.count || 0} résultats
          </p>
        </div>
        <Button onClick={exportToCSV} variant="outline" size="sm">
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-7 gap-4">
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>

        <Select value={saisonFilter} onValueChange={setSaisonFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Saison" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les saisons</SelectItem>
            {saisons?.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.annee}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={courseFilter} onValueChange={setCourseFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Course" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les courses</SelectItem>
            {courses?.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.nom}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            {TYPE_CLASSEMENT_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={statutFilter} onValueChange={setStatutFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            {STATUT_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          type="number"
          placeholder="N° Étape"
          value={etapeFilter}
          onChange={(e) => setEtapeFilter(e.target.value)}
        />

        <Button
          variant="outline"
          onClick={() => {
            setSearch("");
            setSaisonFilter("all");
            setCourseFilter("all");
            setTypeFilter("all");
            setStatutFilter("all");
            setEtapeFilter("");
            setPage(0);
          }}
        >
          Réinitialiser
        </Button>
      </div>

      {/* Mobile View */}
      {isMobile ? (
        <div className="space-y-3">
          {isLoading ? (
            <p className="text-center text-muted-foreground">Chargement...</p>
          ) : results?.data.length === 0 ? (
            <p className="text-center text-muted-foreground">
              Aucun résultat trouvé
            </p>
          ) : (
            results?.data.map((result) => (
              <Card key={result.id}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <p className="font-semibold">{result.coureur_nom}</p>
                      <p className="text-sm text-muted-foreground">
                        {result.coureur_equipe}
                      </p>
                    </div>
                    {result.position && (
                      <Badge variant="outline">#{result.position}</Badge>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={getTypeBadgeVariant(result.type_classement)}>
                      {result.type_classement}
                    </Badge>
                    <Badge variant={getStatutBadgeVariant(result.statut)}>
                      {result.statut}
                    </Badge>
                    {result.etape_numero && (
                      <Badge variant="secondary">Ét. {result.etape_numero}</Badge>
                    )}
                  </div>

                  <div className="text-sm space-y-1">
                    <p>
                      <span className="text-muted-foreground">Course:</span>{" "}
                      {result.course_id}
                    </p>
                    {result.manager_nom && (
                      <p>
                        <span className="text-muted-foreground">Manager:</span>{" "}
                        {result.manager_nom}
                      </p>
                    )}
                    {result.points !== null && result.points > 0 && (
                      <p className="font-semibold">
                        {result.points} points
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      ) : (
        /* Desktop View */
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead
                  className="cursor-pointer"
                  onClick={() => handleSort("course_id")}
                >
                  Course {sortColumn === "course_id" && (sortDirection === "asc" ? "↑" : "↓")}
                </TableHead>
                <TableHead
                  className="cursor-pointer"
                  onClick={() => handleSort("date_classement")}
                >
                  Date {sortColumn === "date_classement" && (sortDirection === "asc" ? "↑" : "↓")}
                </TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Ét.</TableHead>
                <TableHead
                  className="cursor-pointer"
                  onClick={() => handleSort("position")}
                >
                  Pos. {sortColumn === "position" && (sortDirection === "asc" ? "↑" : "↓")}
                </TableHead>
                <TableHead
                  className="cursor-pointer"
                  onClick={() => handleSort("coureur_nom")}
                >
                  Coureur {sortColumn === "coureur_nom" && (sortDirection === "asc" ? "↑" : "↓")}
                </TableHead>
                <TableHead>Équipe</TableHead>
                <TableHead>Manager</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead
                  className="cursor-pointer"
                  onClick={() => handleSort("points")}
                >
                  Points {sortColumn === "points" && (sortDirection === "asc" ? "↑" : "↓")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center">
                    Chargement...
                  </TableCell>
                </TableRow>
              ) : results?.data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center text-muted-foreground">
                    Aucun résultat trouvé
                  </TableCell>
                </TableRow>
              ) : (
                results?.data.map((result) => (
                  <TableRow key={result.id}>
                    <TableCell className="font-medium">
                      {result.course_id}
                    </TableCell>
                    <TableCell>
                      {result.date_classement &&
                        format(new Date(result.date_classement), "dd/MM/yy", {
                          locale: fr,
                        })}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getTypeBadgeVariant(result.type_classement)}>
                        {result.type_classement}
                      </Badge>
                    </TableCell>
                    <TableCell>{result.etape_numero || "-"}</TableCell>
                    <TableCell>
                      {result.position && (
                        <Badge variant="outline">#{result.position}</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{result.coureur_nom}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {result.coureur_equipe}
                      </span>
                    </TableCell>
                    <TableCell>{result.manager_nom || "-"}</TableCell>
                    <TableCell>
                      <Badge variant={getStatutBadgeVariant(result.statut)}>
                        {result.statut || "-"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {result.points !== null && result.points > 0 && (
                        <span className="font-semibold">{result.points}</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setPage(Math.max(0, page - 1))}
          disabled={page === 0}
        >
          <ChevronLeft className="h-4 w-4 mr-2" />
          Précédent
        </Button>

        <span className="text-sm text-muted-foreground">
          Page {page + 1} sur {totalPages || 1}
        </span>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setPage(page + 1)}
          disabled={page >= totalPages - 1}
        >
          Suivant
          <ChevronRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );
};
