import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Upload, X, Shirt, Check } from "lucide-react";
import { cn } from "@/lib/utils";

const sanitizeFileName = (managerName: string, seasonYear: number, extension: string): string => {
  const withoutAccents = managerName.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const sanitized = withoutAccents
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9_]/g, "")
    .toLowerCase();
  
  return `${sanitized}_${seasonYear}.${extension}`;
};

export const JerseyManager = () => {
  const [selectedManager, setSelectedManager] = useState<string>("");
  const [selectedSeason, setSelectedSeason] = useState<string>("");
  const [isDragging, setIsDragging] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: managers } = useQuery({
    queryKey: ['managers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('managers')
        .select('id, nom')
        .order('nom');
      if (error) throw error;
      return data || [];
    },
  });

  const { data: seasons } = useQuery({
    queryKey: ['seasons'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('saisons')
        .select('*')
        .order('annee', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: currentJersey, isLoading: jerseyLoading } = useQuery({
    queryKey: ['current-jersey', selectedManager, selectedSeason],
    queryFn: async () => {
      if (!selectedManager || !selectedSeason) return null;
      
      const { data, error } = await supabase
        .from('manager_sponsors')
        .select('jersey_image_url, sponsor')
        .eq('manager_id', selectedManager)
        .eq('saison_id', selectedSeason)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!selectedManager && !!selectedSeason,
  });

  const uploadJersey = useMutation({
    mutationFn: async (file: File) => {
      if (!selectedManager || !selectedSeason) {
        throw new Error("Veuillez sélectionner un manager et une saison");
      }

      if (file.size > 500 * 1024) {
        throw new Error("Fichier trop volumineux (max 500 Ko)");
      }

      const extension = file.name.split('.').pop()?.toLowerCase();
      if (!extension || !['jpg', 'jpeg', 'png'].includes(extension)) {
        throw new Error("Format invalide (PNG/JPG uniquement)");
      }

      const manager = managers?.find(m => m.id === selectedManager);
      const season = seasons?.find(s => s.id === selectedSeason);
      
      if (!manager || !season) {
        throw new Error("Manager ou saison introuvable");
      }

      const fileName = sanitizeFileName(manager.nom, season.annee, extension);
      const filePath = fileName;

      const { error: uploadError } = await supabase.storage
        .from('sponsor-jerseys')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('sponsor-jerseys')
        .getPublicUrl(filePath);

      // Add cache-busting query parameter to force browser to reload the image
      const cacheBustedUrl = `${publicUrl}?t=${Date.now()}`;

      const { error: upsertError } = await supabase
        .from('manager_sponsors')
        .upsert({
          manager_id: selectedManager,
          saison_id: selectedSeason,
          jersey_image_url: cacheBustedUrl,
          sponsor: currentJersey?.sponsor || '',
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'manager_id,saison_id'
        });

      if (upsertError) throw upsertError;

      return publicUrl;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['current-jersey'] });
      toast({
        title: "✅ Maillot uploadé",
        description: "L'image a été enregistrée avec succès",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "❌ Erreur",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteJersey = useMutation({
    mutationFn: async () => {
      if (!currentJersey?.jersey_image_url) {
        throw new Error("Aucune image à supprimer");
      }

      const fileName = currentJersey.jersey_image_url.split('/').pop();
      
      if (!fileName) {
        throw new Error("Nom de fichier invalide");
      }

      const { error: deleteError } = await supabase.storage
        .from('sponsor-jerseys')
        .remove([fileName]);

      if (deleteError) throw deleteError;

      const { error: updateError } = await supabase
        .from('manager_sponsors')
        .update({ jersey_image_url: null })
        .eq('manager_id', selectedManager)
        .eq('saison_id', selectedSeason);

      if (updateError) throw updateError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['current-jersey'] });
      toast({
        title: "🗑️ Maillot supprimé",
        description: "L'image a été retirée",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "❌ Erreur",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file) {
      uploadJersey.mutate(file);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadJersey.mutate(file);
    }
  };

  const canUpload = selectedManager && selectedSeason;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Gérer les maillots des sponsors</CardTitle>
        <p className="text-sm text-muted-foreground">
          Importez une image de maillot pour chaque manager et chaque saison
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Manager</label>
            <Select value={selectedManager} onValueChange={setSelectedManager}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner un manager" />
              </SelectTrigger>
              <SelectContent>
                {managers?.map(m => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.nom}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Saison</label>
            <Select value={selectedSeason} onValueChange={setSelectedSeason}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner une saison" />
              </SelectTrigger>
              <SelectContent>
                {seasons?.map(s => (
                  <SelectItem key={s.id} value={s.id}>
                    Saison {s.annee}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {canUpload && (
          <div className="space-y-4">
            {currentJersey?.jersey_image_url ? (
              <div className="space-y-4">
                <div className="flex items-center justify-center">
                  <div className="relative">
                    <img
                      src={currentJersey.jersey_image_url}
                      alt="Maillot actuel"
                      className="w-48 h-48 object-contain border rounded-lg shadow-sm"
                    />
                    <div className="absolute -top-2 -right-2 bg-green-500 text-white rounded-full p-1">
                      <Check className="h-4 w-4" />
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 justify-center">
                  <Button
                    variant="outline"
                    onClick={() => document.getElementById('jersey-replace')?.click()}
                    disabled={uploadJersey.isPending}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Remplacer
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => deleteJersey.mutate()}
                    disabled={deleteJersey.isPending}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Supprimer
                  </Button>
                </div>

                <input
                  id="jersey-replace"
                  type="file"
                  accept="image/png,image/jpeg,image/jpg"
                  className="hidden"
                  onChange={handleFileInput}
                />
              </div>
            ) : (
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={cn(
                  "border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors",
                  isDragging
                    ? "border-primary bg-primary/5"
                    : "border-muted-foreground/25 hover:border-primary/50"
                )}
                onClick={() => document.getElementById('jersey-upload')?.click()}
              >
                {uploadJersey.isPending ? (
                  <div className="space-y-2">
                    <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent mx-auto" />
                    <p className="text-sm text-muted-foreground">Upload en cours...</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex justify-center">
                      <Shirt className="h-16 w-16 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-lg font-medium">
                        Glissez-déposez une image ici
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        ou cliquez pour parcourir
                      </p>
                    </div>
                    <div className="text-xs text-muted-foreground space-y-1">
                      <p>Format : PNG, JPG</p>
                      <p>Taille max : 500 Ko</p>
                    </div>
                  </div>
                )}

                <input
                  id="jersey-upload"
                  type="file"
                  accept="image/png,image/jpeg,image/jpg"
                  className="hidden"
                  onChange={handleFileInput}
                />
              </div>
            )}
          </div>
        )}

        {!canUpload && (
          <div className="text-center py-8 text-muted-foreground">
            Veuillez sélectionner un manager et une saison
          </div>
        )}
      </CardContent>
    </Card>
  );
};
