import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2 } from "lucide-react";

export const ResultsPage = () => {
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadResults();
  }, []);

  const loadResults = async () => {
    setLoading(true);
    try {
      // Récupérer les résultats de course avec les infos du coureur et course
      const { data, error } = await supabase
        .from('race_results')
        .select(`
          *,
          coureurs (nom, equipe),
          courses (nom, categorie, date_debut, date_fin)
        `)
        .order('date_classement', { ascending: false })
        .limit(100);

      if (error) throw error;
      console.log('Results loaded:', data);
      setResults(data || []);
    } catch (error) {
      console.error('Error loading results:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatutBadge = (statut: string) => {
    const variants: Record<string, any> = {
      finished: 'default',
      dnf: 'destructive',
      dns: 'secondary',
      dsq: 'destructive'
    };
    return (
      <Badge variant={variants[statut] || 'secondary'}>
        {statut?.toUpperCase() || 'N/A'}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <h1 className="text-3xl font-bold">Résultats</h1>
        <p className="text-muted-foreground">
          {results.length} résultats de course
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : results.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">Aucun résultat de course trouvé</p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Course</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Étape</TableHead>
                <TableHead>Coureur</TableHead>
                <TableHead>Équipe</TableHead>
                <TableHead>Position</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Points</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.map((result: any) => (
                <TableRow key={result.id}>
                  <TableCell className="font-medium">
                    {result.courses?.nom || result.course_id}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{result.type_classement}</Badge>
                  </TableCell>
                  <TableCell>{result.etape_numero || '-'}</TableCell>
                  <TableCell>{result.coureurs?.nom || result.coureur_id}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{result.coureurs?.equipe || '-'}</Badge>
                  </TableCell>
                  <TableCell className="font-semibold">{result.position || '-'}</TableCell>
                  <TableCell>{getStatutBadge(result.statut)}</TableCell>
                  <TableCell className="font-semibold">{result.points}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {result.date_classement ? new Date(result.date_classement).toLocaleDateString('fr-FR') : '-'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
};
