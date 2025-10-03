import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { RecentRacesList } from "./RecentRacesList";
import { CourseResultsDetail } from "./CourseResultsDetail";
import { useToast } from "@/hooks/use-toast";

interface ManagerResultsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  managerId: string;
}

export const ManagerResultsDrawer = ({ open, onOpenChange, managerId }: ManagerResultsDrawerProps) => {
  const { toast } = useToast();
  const [saisons, setSaisons] = useState<any[]>([]);
  const [phases, setPhases] = useState<any[]>([]);
  const [selectedSaison, setSelectedSaison] = useState<string>("");
  const [selectedPhase, setSelectedPhase] = useState<string>("");
  const [search, setSearch] = useState("");
  const [races, setRaces] = useState<any[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      loadSaisons();
      loadRecentRaces();
    }
  }, [open]);

  useEffect(() => {
    if (selectedSaison) {
      loadPhases(selectedSaison);
    } else {
      setPhases([]);
      setSelectedPhase("");
    }
  }, [selectedSaison]);

  useEffect(() => {
    if (open) {
      loadRecentRaces();
    }
  }, [selectedSaison, selectedPhase, search]);

  const loadSaisons = async () => {
    const { data } = await supabase
      .from('saisons')
      .select('*')
      .order('annee', { ascending: false });
    setSaisons(data || []);
  };

  const loadPhases = async (saisonId: string) => {
    const { data } = await supabase
      .from('phases')
      .select('*')
      .eq('saison_id', saisonId)
      .order('index_dans_saison', { ascending: false });
    setPhases(data || []);
  };

  const loadRecentRaces = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('manager-results', {
        body: {
          action: 'recent_races',
          saison_id: selectedSaison || undefined,
          phase_id: selectedPhase || undefined,
          search: search || undefined,
          limit: 10
        }
      });

      if (error) throw error;

      setRaces(data.races || []);
      
      // Auto-select first race
      if (data.races && data.races.length > 0 && !selectedCourse) {
        setSelectedCourse(data.races[0]);
      }
    } catch (error: any) {
      console.error('Error loading races:', error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de charger les courses"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-4xl p-0 flex flex-col">
        <SheetHeader className="p-6 border-b">
          <SheetTitle>Résultats</SheetTitle>
          <SheetDescription>Courses avec résultats saisis</SheetDescription>
          
          <div className="flex flex-wrap gap-2 mt-4">
            <Select value={selectedSaison} onValueChange={setSelectedSaison}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Toutes saisons" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Toutes saisons</SelectItem>
                {saisons.map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.annee}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedPhase} onValueChange={setSelectedPhase} disabled={!selectedSaison}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Toutes phases" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Toutes phases</SelectItem>
                {phases.map(p => (
                  <SelectItem key={p.id} value={p.id}>
                    Phase {p.index_dans_saison}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              placeholder="Rechercher une course"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 min-w-[200px]"
            />
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-hidden flex">
          <RecentRacesList
            races={races}
            selectedCourse={selectedCourse}
            onSelectCourse={setSelectedCourse}
            loading={loading}
          />

          <CourseResultsDetail
            course={selectedCourse}
            managerId={managerId}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
};
