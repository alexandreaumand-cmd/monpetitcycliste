import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight, Info } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { Database } from "@/integrations/supabase/types";

type TypeClassement = Database["public"]["Enums"]["type_classement"];

interface PointsBaremeSectionProps {
  courseId: string | null;
  typeClassement: string;
}

interface BaremeEntry {
  place: number;
  points: number;
}

export const PointsBaremeSection = ({ courseId, typeClassement }: PointsBaremeSectionProps) => {
  const [isOpen, setIsOpen] = useState(false);

  // Fetch the course category AND its season via phase
  const { data: courseData } = useQuery({
    queryKey: ["course-category-season", courseId],
    queryFn: async () => {
      if (!courseId) return null;
      
      // Fetch course with phase to get season
      const { data: courseInfo, error: courseError } = await supabase
        .from("courses")
        .select("categorie, phase_id, phases(saison_id)")
        .eq("id", courseId)
        .single();
      
      if (courseError || !courseInfo) return null;
      
      // Get normalized category from view
      const { data: normData } = await supabase
        .from("courses_for_points_norm")
        .select("cat_canon, cat_raw")
        .eq("id", courseId)
        .single();
      
      const categorie = normData?.cat_canon || normData?.cat_raw || courseInfo.categorie;
      const saisonId = (courseInfo.phases as any)?.saison_id;
      
      return { categorie, saisonId };
    },
    enabled: !!courseId && isOpen,
  });

  // Then fetch the barème for that category and type using course's season
  const { data: bareme, isLoading } = useQuery({
    queryKey: ["scoring-rules", courseData?.categorie, typeClassement, courseData?.saisonId],
    queryFn: async () => {
      if (!courseData?.categorie || !courseData?.saisonId) return [];
      
      const { data, error } = await supabase
        .from("scoring_rules_saisons")
        .select("place, points")
        .eq("categorie", courseData.categorie)
        .eq("type_classement", typeClassement as TypeClassement)
        .eq("saison_id", courseData.saisonId)
        .order("place", { ascending: true });
      
      if (error) {
        console.error("Error fetching bareme:", error);
        return [];
      }
      
      // Remove duplicates (keep first occurrence)
      const seen = new Set<number>();
      const unique: BaremeEntry[] = [];
      for (const item of data || []) {
        if (!seen.has(item.place)) {
          seen.add(item.place);
          unique.push(item);
        }
      }
      
      return unique;
    },
    enabled: !!courseData?.categorie && !!courseData?.saisonId && isOpen,
  });

  const getTypeLabel = (type: string): string => {
    switch (type) {
      case "General": return "Classement Général";
      case "Etape": return "Étape";
      case "Points": return "Points (Vert)";
      case "Montagne": return "Montagne (Pois)";
      case "Jeune": return "Jeune (Blanc)";
      case "Combatif": return "Super Combatif";
      default: return type;
    }
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <button className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors p-2 rounded-md hover:bg-muted/50 w-full">
          {isOpen ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
          <Info className="h-4 w-4" />
          <span>Voir le barème des points</span>
          {courseData?.categorie && (
            <Badge variant="outline" className="text-xs ml-auto">
              {courseData.categorie}
            </Badge>
          )}
        </button>
      </CollapsibleTrigger>
      
      <CollapsibleContent>
        <div className="mt-2 p-3 bg-muted/30 rounded-lg border">
          <div className="flex items-center gap-2 mb-3">
            <span className="font-medium text-sm">Barème - {getTypeLabel(typeClassement)}</span>
          </div>
          
          {isLoading ? (
            <div className="space-y-1">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-6 w-full" />
              ))}
            </div>
          ) : bareme && bareme.length > 0 ? (
            <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-1">
              {bareme.map((entry) => (
                <div
                  key={entry.place}
                  className="flex flex-col items-center p-1.5 rounded bg-background border text-center"
                >
                  <span className="text-xs text-muted-foreground">
                    {entry.place === 1 ? "🥇" : entry.place === 2 ? "🥈" : entry.place === 3 ? "🥉" : `${entry.place}e`}
                  </span>
                  <span className="font-bold text-sm">{entry.points}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Aucun barème disponible pour cette catégorie et ce type de classement.
            </p>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};
