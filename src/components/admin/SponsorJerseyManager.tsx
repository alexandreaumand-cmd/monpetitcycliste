import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Upload, Trash2, Loader2 } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

export const SponsorJerseyManager = () => {
  const [selectedSeason, setSelectedSeason] = useState<string>("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch seasons
  const { data: seasons, isLoading: loadingSeasons } = useQuery({
    queryKey: ['seasons'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('saisons')
        .select('*')
        .order('annee', { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  // Fetch managers with sponsors/jerseys for selected season
  const { data: managersData, isLoading: loadingManagers } = useQuery({
    queryKey: ['managers-sponsors-jerseys', selectedSeason],
    queryFn: async () => {
      if (!selectedSeason) return [];

      const { data: managers, error: managersError } = await supabase
        .from('managers')
        .select('*')
        .order('nom');
      
      if (managersError) throw managersError;

      const { data: sponsors, error: sponsorsError } = await supabase
        .from('manager_sponsors')
        .select('*')
        .eq('saison_id', selectedSeason);
      
      if (sponsorsError) throw sponsorsError;

      return managers.map(m => {
        const sponsorData = sponsors?.find(s => s.manager_id === m.id);
        return {
          id: m.id,
          nom: m.nom,
          sponsor: sponsorData?.sponsor || '',
          jersey_url: sponsorData?.jersey_image_url || null,
          sponsor_id: sponsorData?.id || null,
        };
      });
    },
    enabled: !!selectedSeason,
  });

  // Update sponsor mutation
  const updateSponsor = useMutation({
    mutationFn: async ({ managerId, sponsor }: { managerId: string; sponsor: string }) => {
      const { error } = await supabase
        .from('manager_sponsors')
        .upsert({
          manager_id: managerId,
          saison_id: selectedSeason,
          sponsor: sponsor,
        }, {
          onConflict: 'manager_id,saison_id'
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['managers-sponsors-jerseys', selectedSeason] });
      toast({ title: "Sponsor mis à jour" });
    },
    onError: () => {
      toast({ title: "Erreur lors de la mise à jour", variant: "destructive" });
    },
  });

  // Sanitize filename to remove accents and special characters
  const sanitizeFileName = (name: string): string => {
    return name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove accents
      .replace(/[^a-zA-Z0-9]/g, '_')   // Replace special chars with underscore
      .replace(/_+/g, '_')             // Collapse multiple underscores
      .replace(/^_|_$/g, '');          // Trim leading/trailing underscores
  };

  // Upload jersey mutation
  const uploadJersey = useMutation({
    mutationFn: async ({ managerId, managerNom, file }: { managerId: string; managerNom: string; file: File }) => {
      const season = seasons?.find(s => s.id === selectedSeason);
      if (!season) throw new Error("Saison non trouvée");

      // Get existing sponsor
      const { data: existing } = await supabase
        .from('manager_sponsors')
        .select('sponsor')
        .eq('manager_id', managerId)
        .eq('saison_id', selectedSeason)
        .single();

      const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const sanitizedName = sanitizeFileName(managerNom);
      const fileName = `${sanitizedName}_${season.annee}.${fileExt}`;
      const filePath = fileName;

      console.log('Uploading jersey:', { filePath, fileSize: file.size, fileType: file.type });

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('sponsor-jerseys')
        .upload(filePath, file, { upsert: true });

      if (uploadError) {
        console.error('Storage upload error:', uploadError);
        throw uploadError;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('sponsor-jerseys')
        .getPublicUrl(filePath);

      // Update manager_sponsors with jersey URL
      const { error: updateError } = await supabase
        .from('manager_sponsors')
        .upsert({
          manager_id: managerId,
          saison_id: selectedSeason,
          sponsor: existing?.sponsor || '',
          jersey_image_url: publicUrl,
        }, {
          onConflict: 'manager_id,saison_id'
        });

      if (updateError) throw updateError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['managers-sponsors-jerseys', selectedSeason] });
      toast({ title: "Maillot uploadé avec succès" });
    },
    onError: (error: any) => {
      console.error('Jersey upload failed:', error);
      toast({ 
        title: "Erreur lors de l'upload", 
        description: error?.message || "Vérifiez vos permissions",
        variant: "destructive" 
      });
    },
  });

  // Delete jersey mutation
  const deleteJersey = useMutation({
    mutationFn: async ({ managerId, jerseyUrl }: { managerId: string; jerseyUrl: string }) => {
      // Extract file path from URL
      const filePath = jerseyUrl.split('/').pop();
      if (!filePath) throw new Error("Invalid jersey URL");

      // Delete from storage
      const { error: deleteError } = await supabase.storage
        .from('sponsor-jerseys')
        .remove([filePath]);

      if (deleteError) throw deleteError;

      // Update manager_sponsors to remove jersey URL
      const { error: updateError } = await supabase
        .from('manager_sponsors')
        .update({ jersey_image_url: null })
        .eq('manager_id', managerId)
        .eq('saison_id', selectedSeason);

      if (updateError) throw updateError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['managers-sponsors-jerseys', selectedSeason] });
      toast({ title: "Maillot supprimé" });
    },
    onError: () => {
      toast({ title: "Erreur lors de la suppression", variant: "destructive" });
    },
  });

  const handleFileUpload = (managerId: string, managerNom: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 500000) {
      toast({ title: "Fichier trop volumineux (max 500 Ko)", variant: "destructive" });
      return;
    }

    uploadJersey.mutate({ managerId, managerNom, file });
  };

  if (loadingSeasons) {
    return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Gestion Sponsors & Maillots</CardTitle>
        <CardDescription>
          Gérer les sponsors et maillots des managers par saison
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label>Saison</Label>
          <Select value={selectedSeason} onValueChange={setSelectedSeason}>
            <SelectTrigger>
              <SelectValue placeholder="Sélectionner une saison" />
            </SelectTrigger>
            <SelectContent>
              {seasons?.map((season) => (
                <SelectItem key={season.id} value={season.id}>
                  {season.annee}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedSeason && (
          <>
            {loadingManagers ? (
              <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-[150px_1fr_120px_120px] gap-4 font-medium text-sm pb-2 border-b">
                  <div>Manager</div>
                  <div>Sponsor</div>
                  <div>Maillot</div>
                  <div>Actions</div>
                </div>
                {managersData?.map((manager) => (
                  <div key={manager.id} className="grid grid-cols-[150px_1fr_120px_120px] gap-4 items-center">
                    <div className="font-medium">{manager.nom}</div>
                    <Input
                      value={manager.sponsor}
                      onChange={(e) => {
                        const newValue = e.target.value;
                        queryClient.setQueryData(
                          ['managers-sponsors-jerseys', selectedSeason],
                          (old: any[]) => old.map(m => m.id === manager.id ? { ...m, sponsor: newValue } : m)
                        );
                      }}
                      onBlur={(e) => {
                        updateSponsor.mutate({ managerId: manager.id, sponsor: e.target.value });
                      }}
                      placeholder="Nom du sponsor"
                    />
                    <div className="flex items-center justify-center">
                      {manager.jersey_url ? (
                        <Avatar className="h-12 w-12">
                          <AvatarImage src={manager.jersey_url} alt={`Maillot ${manager.nom}`} />
                          <AvatarFallback>{manager.nom.substring(0, 2)}</AvatarFallback>
                        </Avatar>
                      ) : (
                        <div className="text-sm text-muted-foreground">Pas de maillot</div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => document.getElementById(`file-${manager.id}`)?.click()}
                      >
                        <Upload className="h-4 w-4" />
                      </Button>
                      <input
                        id={`file-${manager.id}`}
                        type="file"
                        accept="image/png,image/jpeg"
                        className="hidden"
                        onChange={(e) => handleFileUpload(manager.id, manager.nom, e)}
                      />
                      {manager.jersey_url && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => deleteJersey.mutate({ managerId: manager.id, jerseyUrl: manager.jersey_url! })}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};
