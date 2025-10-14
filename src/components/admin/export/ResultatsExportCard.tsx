import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { Download, Loader2, Trophy } from "lucide-react";

export const ResultatsExportCard = () => {
  const [exporting, setExporting] = useState(false);
  const [courseId, setCourseId] = useState<string>("all");
  const { toast } = useToast();

  const { data: courses } = useQuery({
    queryKey: ['courses_recent'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('courses')
        .select('id, nom, date_debut')
        .order('date_debut', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  const handleExport = async () => {
    setExporting(true);

    try {
      const { data, error } = await supabase.functions.invoke('export-resultats-csv', {
        body: courseId === "all" ? {} : { course_id: courseId },
      });

      if (error) throw error;

      const blob = new Blob([data], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'resultats_export.csv';
      link.click();
      URL.revokeObjectURL(link.href);

      toast({
        title: "✅ Export réussi",
        description: "Le fichier resultats_export.csv a été téléchargé",
      });
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: "Erreur d'export",
        description: error.message || "Une erreur est survenue",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5" />
          Résultats
        </CardTitle>
        <CardDescription>
          Exporter les résultats d'une course (limité à 5000 lignes)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Course</Label>
          <Select value={courseId} onValueChange={setCourseId}>
            <SelectTrigger>
              <SelectValue placeholder="Toutes les courses récentes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les courses récentes</SelectItem>
              {courses?.map((course) => (
                <SelectItem key={course.id} value={course.id}>
                  {course.nom} ({course.date_debut})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button onClick={handleExport} disabled={exporting} className="w-full">
          {exporting ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Export...</>
          ) : (
            <><Download className="mr-2 h-4 w-4" /> Exporter CSV</>
          )}
        </Button>
      </CardContent>
    </Card>
  );
};
