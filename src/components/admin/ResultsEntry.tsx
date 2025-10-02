import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";

type RaceType = "stage races" | "one day race";
type ClassementType = "General" | "Etape" | "Jeune" | "Montagne" | "Points";

const classementLabels: Record<ClassementType, string> = {
  General: "Classement Général",
  Etape: "Classement Étape",
  Jeune: "Classement Jeune",
  Montagne: "Classement Montagne",
  Points: "Classement Points",
};

export const ResultsEntry = () => {
  const [selectedRaceType, setSelectedRaceType] = useState<RaceType | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<string | null>(null);
  const [selectedStage, setSelectedStage] = useState<string | null>(null);

  // Fetch courses based on race type
  const { data: courses } = useQuery({
    queryKey: ['courses', selectedRaceType],
    queryFn: async () => {
      if (!selectedRaceType) return [];
      
      const { data, error } = await supabase
        .from('courses')
        .select('*')
        .eq('type_course', selectedRaceType)
        .order('nom');
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedRaceType,
  });

  // Get course details for stage count
  const selectedCourseData = courses?.find(c => c.id === selectedCourse);

  // Determine classification type options based on race type and stage
  const getClassementTypes = (): ClassementType[] => {
    if (!selectedRaceType) return [];
    
    if (selectedRaceType === "one day race") {
      return ["General"];
    }
    
    // Stage race
    if (selectedStage === "CG") {
      return ["General", "Jeune", "Montagne", "Points"];
    }
    
    return ["Etape"];
  };

  const classementType = getClassementTypes()[0]; // Auto-select based on context

  // Fetch scoring rules
  const { data: scoringRules } = useQuery({
    queryKey: ['scoring-rules', selectedCourseData?.categorie, classementType, selectedRaceType],
    queryFn: async () => {
      if (!selectedCourseData || !classementType) return [];
      
      const { data, error } = await supabase
        .from('scoring_rules')
        .select('*')
        .eq('categorie', selectedCourseData.categorie)
        .eq('type_classement', classementType)
        .eq('type', selectedRaceType)
        .order('place');
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedCourseData && !!classementType,
  });

  // Generate stage options for stage races
  const getStageOptions = () => {
    if (!selectedCourseData || selectedRaceType !== "stage races") return [];
    
    // Estimate stages based on date range
    const dateDebut = selectedCourseData.date_debut ? new Date(selectedCourseData.date_debut) : null;
    const dateFin = selectedCourseData.date_fin ? new Date(selectedCourseData.date_fin) : null;
    
    if (!dateDebut || !dateFin) return ["CG"];
    
    const daysDiff = Math.ceil((dateFin.getTime() - dateDebut.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const stages = Array.from({ length: daysDiff }, (_, i) => `Etape ${i + 1}`);
    
    return [...stages, "CG"];
  };

  const handleRaceTypeChange = (value: string) => {
    setSelectedRaceType(value as RaceType);
    setSelectedCourse(null);
    setSelectedStage(null);
  };

  const handleCourseChange = (value: string) => {
    setSelectedCourse(value);
    setSelectedStage(null);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Saisie manuelle des résultats</CardTitle>
        <CardDescription>
          Sélectionnez une course et le barème s'affichera automatiquement
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Step 1: Race Type */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Type de course</label>
          <Select value={selectedRaceType || ""} onValueChange={handleRaceTypeChange}>
            <SelectTrigger>
              <SelectValue placeholder="Sélectionner le type de course" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="one day race">Course d'un jour</SelectItem>
              <SelectItem value="stage races">Course à étapes</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Step 2: Course Selection */}
        {selectedRaceType && (
          <div className="space-y-2">
            <label className="text-sm font-medium">Course</label>
            <Select value={selectedCourse || ""} onValueChange={handleCourseChange}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner une course" />
              </SelectTrigger>
              <SelectContent>
                {courses?.map((course) => (
                  <SelectItem key={course.id} value={course.id}>
                    {course.nom} - {course.categorie}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Step 3: Stage Selection (only for stage races) */}
        {selectedRaceType === "stage races" && selectedCourse && (
          <div className="space-y-2">
            <label className="text-sm font-medium">Étape / Classement</label>
            <Select value={selectedStage || ""} onValueChange={setSelectedStage}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner une étape" />
              </SelectTrigger>
              <SelectContent>
                {getStageOptions().map((stage) => (
                  <SelectItem key={stage} value={stage}>
                    {stage}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Display Scoring Table */}
        {selectedCourseData && 
         ((selectedRaceType === "one day race") || 
          (selectedRaceType === "stage races" && selectedStage)) && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold">Barème de points</h3>
              <Badge variant="secondary">{classementType && classementLabels[classementType]}</Badge>
            </div>
            
            {scoringRules && scoringRules.length > 0 ? (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Position</TableHead>
                      <TableHead className="text-right">Points</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {scoringRules.map((rule) => (
                      <TableRow key={rule.id}>
                        <TableCell className="font-medium">{rule.place}</TableCell>
                        <TableCell className="text-right font-semibold text-primary">
                          {rule.points}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground border rounded-md">
                Aucun barème disponible pour cette catégorie
              </div>
            )}

            <div className="p-4 bg-muted rounded-md text-sm space-y-1">
              <p><strong>Catégorie:</strong> {selectedCourseData.categorie}</p>
              <p><strong>Type:</strong> {selectedRaceType}</p>
              {selectedStage && <p><strong>Étape:</strong> {selectedStage}</p>}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
