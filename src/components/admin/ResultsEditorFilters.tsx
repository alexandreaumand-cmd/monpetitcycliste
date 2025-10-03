import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ResultsEditorFiltersProps {
  selectedCourse: string;
  onCourseChange: (value: string) => void;
  typeClassement: string;
  onTypeClassementChange: (value: string) => void;
  etapeNumero: number | null;
  onEtapeNumeroChange: (value: number | null) => void;
  search: string;
  onSearchChange: (value: string) => void;
}

export const ResultsEditorFilters = ({
  selectedCourse,
  onCourseChange,
  typeClassement,
  onTypeClassementChange,
  etapeNumero,
  onEtapeNumeroChange,
  search,
  onSearchChange
}: ResultsEditorFiltersProps) => {
  // Fetch courses with results
  const { data: courses } = useQuery({
    queryKey: ['courses-with-results'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('courses')
        .select('id, nom, date_debut, categorie')
        .order('date_debut', { ascending: false })
        .limit(100);

      if (error) throw error;
      return data;
    }
  });

  const typeClassementOptions = [
    { value: 'Etape', label: 'Étape' },
    { value: 'General', label: 'Général' },
    { value: 'Points', label: 'Points' },
    { value: 'Montagne', label: 'Montagne' },
    { value: 'Jeune', label: 'Jeune' }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <div className="space-y-2">
        <Label>Course</Label>
        <Select value={selectedCourse} onValueChange={onCourseChange}>
          <SelectTrigger>
            <SelectValue placeholder="Sélectionner une course" />
          </SelectTrigger>
          <SelectContent>
            {courses?.map((course) => (
              <SelectItem key={course.id} value={course.id}>
                {course.nom} ({course.categorie})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Type de classement</Label>
        <Select value={typeClassement} onValueChange={onTypeClassementChange}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {typeClassementOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {typeClassement === 'Etape' && (
        <div className="space-y-2">
          <Label>Numéro d'étape</Label>
          <Input
            type="number"
            min="1"
            placeholder="Ex: 1"
            value={etapeNumero || ''}
            onChange={(e) => onEtapeNumeroChange(e.target.value ? parseInt(e.target.value) : null)}
          />
        </div>
      )}

      <div className="space-y-2">
        <Label>Rechercher un coureur</Label>
        <Input
          placeholder="Nom du coureur..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>
    </div>
  );
};
