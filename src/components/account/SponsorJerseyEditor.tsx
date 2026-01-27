import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Shirt, Upload, Trash2, AlertCircle } from "lucide-react";
import { useSeasonContext } from "@/contexts/SeasonContext";
import { useManagerSponsor } from "@/hooks/useManagerSponsor";
import { useQueryClient } from "@tanstack/react-query";

interface SponsorJerseyEditorProps {
  managerId: string;
  managerName: string;
}

// Sanitize filename to remove accents and special characters
const sanitizeFileName = (fileName: string): string => {
  return fileName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove accents
    .replace(/[^a-zA-Z0-9._-]/g, "_") // Replace special chars with underscore
    .replace(/_+/g, "_") // Remove consecutive underscores
    .replace(/^_|_$/g, ""); // Remove leading/trailing underscores
};

export function SponsorJerseyEditor({ managerId, managerName }: SponsorJerseyEditorProps) {
  const { t } = useTranslation('account');
  const { selectedSeason, isLoading: seasonLoading } = useSeasonContext();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { data: sponsorData, isLoading: sponsorLoading, refetch } = useManagerSponsor(
    managerId, 
    selectedSeason?.id
  );

  const [sponsorName, setSponsorName] = useState("");
  const [jerseyUrl, setJerseyUrl] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Sync state when data loads
  useEffect(() => {
    if (sponsorData) {
      setSponsorName(sponsorData.sponsor || "");
      setJerseyUrl(sponsorData.jersey_image_url);
    } else {
      setSponsorName("");
      setJerseyUrl(null);
    }
  }, [sponsorData]);

  const handleUpdateSponsor = async () => {
    if (!selectedSeason) return;
    
    setUpdating(true);
    try {
      const { error } = await supabase
        .from('manager_sponsors')
        .upsert({
          manager_id: managerId,
          saison_id: selectedSeason.id,
          sponsor: sponsorName,
          jersey_image_url: jerseyUrl,
        }, {
          onConflict: 'manager_id,saison_id'
        });

      if (error) throw error;

      toast.success(t('sponsorJersey.updateSuccess'));
      refetch();
      queryClient.invalidateQueries({ queryKey: ['manager-sponsor'] });
      queryClient.invalidateQueries({ queryKey: ['manager-jerseys-batch'] });
    } catch (error) {
      console.error("Error updating sponsor:", error);
      toast.error(t('sponsorJersey.updateError'));
    } finally {
      setUpdating(false);
    }
  };

  const handleJerseyUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedSeason) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error(t('sponsorJersey.invalidFileType'));
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error(t('sponsorJersey.fileTooLarge'));
      return;
    }

    setUploading(true);
    try {
      const sanitizedName = sanitizeFileName(file.name);
      const filePath = `${managerId}/${selectedSeason.id}/${sanitizedName}`;

      const { error: uploadError } = await supabase.storage
        .from('sponsor-jerseys')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('sponsor-jerseys')
        .getPublicUrl(filePath);

      // Add cache-busting timestamp
      const urlWithCacheBuster = `${publicUrl}?t=${Date.now()}`;
      setJerseyUrl(urlWithCacheBuster);

      // Save to database immediately
      const { error: dbError } = await supabase
        .from('manager_sponsors')
        .upsert({
          manager_id: managerId,
          saison_id: selectedSeason.id,
          sponsor: sponsorName || managerName,
          jersey_image_url: urlWithCacheBuster,
        }, {
          onConflict: 'manager_id,saison_id'
        });

      if (dbError) throw dbError;

      toast.success(t('sponsorJersey.uploadSuccess'));
      refetch();
      queryClient.invalidateQueries({ queryKey: ['manager-sponsor'] });
      queryClient.invalidateQueries({ queryKey: ['manager-jerseys-batch'] });
    } catch (error) {
      console.error("Error uploading jersey:", error);
      toast.error(t('sponsorJersey.uploadError'));
    } finally {
      setUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDeleteJersey = async () => {
    if (!selectedSeason || !jerseyUrl) return;

    setUpdating(true);
    try {
      // Update database to remove jersey URL
      const { error } = await supabase
        .from('manager_sponsors')
        .upsert({
          manager_id: managerId,
          saison_id: selectedSeason.id,
          sponsor: sponsorName || managerName,
          jersey_image_url: null,
        }, {
          onConflict: 'manager_id,saison_id'
        });

      if (error) throw error;

      setJerseyUrl(null);
      toast.success(t('sponsorJersey.deleteSuccess'));
      refetch();
      queryClient.invalidateQueries({ queryKey: ['manager-sponsor'] });
      queryClient.invalidateQueries({ queryKey: ['manager-jerseys-batch'] });
    } catch (error) {
      console.error("Error deleting jersey:", error);
      toast.error(t('sponsorJersey.deleteError'));
    } finally {
      setUpdating(false);
    }
  };

  const isLoading = seasonLoading || sponsorLoading;
  const noSeason = !selectedSeason && !seasonLoading;

  return (
    <Card className="mb-4 md:mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shirt className="h-5 w-5" />
          {t('sponsorJersey.title')}
        </CardTitle>
        <CardDescription className="hidden sm:block">
          {selectedSeason 
            ? t('sponsorJersey.descriptionWithSeason', { season: selectedSeason.annee })
            : t('sponsorJersey.description')
          }
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 sm:space-y-6">
        {noSeason ? (
          <div className="flex items-start gap-3 p-4 bg-muted rounded-lg">
            <AlertCircle className="h-5 w-5 text-muted-foreground mt-0.5" />
            <p className="text-sm text-muted-foreground">
              {t('sponsorJersey.noSeason')}
            </p>
          </div>
        ) : isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* Jersey preview and sponsor name side by side on larger screens */}
            <div className="flex flex-col sm:flex-row gap-6">
              {/* Jersey preview */}
              <div className="flex flex-col items-center gap-3">
                <Avatar className="h-16 w-16 sm:h-24 sm:w-24 border-2 border-dashed border-border">
                  {jerseyUrl ? (
                    <AvatarImage src={jerseyUrl} alt={sponsorName || managerName} />
                  ) : null}
                  <AvatarFallback className="bg-muted text-muted-foreground">
                    <Shirt className="h-10 w-10" />
                  </AvatarFallback>
                </Avatar>
                
                {/* Upload/Delete buttons */}
                <div className="flex gap-2">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleJerseyUpload}
                    accept="image/*"
                    className="hidden"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading || updating}
                  >
                    {uploading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4" />
                    )}
                    <span className="ml-1 hidden sm:inline">
                      {jerseyUrl ? t('sponsorJersey.changeJersey') : t('sponsorJersey.uploadJersey')}
                    </span>
                  </Button>
                  {jerseyUrl && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleDeleteJersey}
                      disabled={updating}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>

              {/* Sponsor name input */}
              <div className="flex-1 space-y-2">
                <Label htmlFor="sponsor-name">{t('sponsorJersey.sponsorName')}</Label>
                <Input
                  id="sponsor-name"
                  value={sponsorName}
                  onChange={(e) => setSponsorName(e.target.value)}
                  placeholder={t('sponsorJersey.sponsorPlaceholder')}
                  disabled={updating || uploading}
                />
                <p className="text-xs text-muted-foreground">
                  {t('sponsorJersey.sponsorHint')}
                </p>
              </div>
            </div>

            {/* Update button */}
            <Button 
              onClick={handleUpdateSponsor} 
              disabled={updating || uploading}
              className="w-full sm:w-auto"
            >
              {updating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('sponsorJersey.updating')}
                </>
              ) : (
                t('sponsorJersey.update')
              )}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
