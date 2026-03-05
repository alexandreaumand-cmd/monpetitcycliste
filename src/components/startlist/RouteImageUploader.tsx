import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Upload, X, Image as ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface RouteImage {
  etape_numero: number | null;
  image_url: string;
  label: string | null;
  sort_order: number;
}

interface RouteImageUploaderProps {
  raceId: string;
  currentImageUrl: string | null;
  onUploadComplete: (url: string) => void;
  isStageRace?: boolean;
  totalStages?: number;
}

export function RouteImageUploader({ raceId, currentImageUrl, onUploadComplete, isStageRace = false, totalStages = 0 }: RouteImageUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [selectedStage, setSelectedStage] = useState<number | null>(null); // null = overview
  const [existingImages, setExistingImages] = useState<RouteImage[]>([]);

  useEffect(() => {
    if (isStageRace) {
      loadExistingImages();
    }
  }, [raceId, isStageRace]);

  const loadExistingImages = async () => {
    const { data } = await supabase
      .from('course_route_images')
      .select('etape_numero, image_url, label, sort_order')
      .eq('course_id', raceId)
      .order('sort_order', { ascending: true });
    setExistingImages(data || []);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Format non supporté", { description: "Veuillez utiliser PNG, JPG ou WebP" });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Fichier trop volumineux", { description: "La taille maximale est de 5 MB" });
      return;
    }

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('race_id', raceId);
      formData.append('file', file);
      
      if (isStageRace && selectedStage !== null) {
        formData.append('etape_numero', String(selectedStage));
        formData.append('label', `Étape ${selectedStage}`);
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Vous devez être connecté");
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/startlist-upload-route-image`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${session.access_token}` },
          body: formData,
        }
      );

      const json = await response.json();
      if (!response.ok) throw new Error(json?.error || 'Upload failed');

      if (json?.route_image_url) {
        onUploadComplete(json.route_image_url);
        toast.success("Image téléchargée", {
          description: isStageRace && selectedStage !== null 
            ? `Étape ${selectedStage} mise à jour` 
            : "L'image du parcours a été mise à jour"
        });
        if (isStageRace) {
          loadExistingImages();
        }
      }
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error("Erreur lors du téléchargement", { description: error.message || "Une erreur s'est produite" });
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  // Simple mode for one-day races
  if (!isStageRace) {
    return (
      <div>
        <input
          type="file"
          id="route-image-upload"
          accept="image/png,image/jpeg,image/jpg,image/webp"
          onChange={handleFileChange}
          className="hidden"
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => document.getElementById('route-image-upload')?.click()}
          disabled={isUploading}
        >
          <Upload className="h-4 w-4 mr-2" />
          {isUploading ? 'Téléchargement...' : currentImageUrl ? 'Modifier le parcours' : 'Ajouter le parcours'}
        </Button>
      </div>
    );
  }

  // Multi-stage mode
  const stageOptions = [
    { value: null as number | null, label: 'Vue d\'ensemble' },
    ...Array.from({ length: totalStages }, (_, i) => ({ value: i + 1, label: `Étape ${i + 1}` }))
  ];

  const getImageForStage = (stageNum: number | null) => 
    existingImages.find(img => img.etape_numero === stageNum);

  return (
    <div className="space-y-3">
      <input
        type="file"
        id="route-image-upload-stage"
        accept="image/png,image/jpeg,image/jpg,image/webp"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Stage selector */}
      <div className="flex flex-wrap gap-1.5">
        {stageOptions.map((opt) => {
          const hasImage = !!getImageForStage(opt.value);
          return (
            <Button
              key={opt.value ?? 'overview'}
              variant={selectedStage === opt.value ? "default" : "outline"}
              size="sm"
              className={cn(
                "text-xs h-7 px-2",
                hasImage && selectedStage !== opt.value && "border-green-500/50 text-green-700"
              )}
              onClick={() => setSelectedStage(opt.value)}
            >
              {hasImage && <ImageIcon className="h-3 w-3 mr-1" />}
              {opt.label}
            </Button>
          );
        })}
      </div>

      {/* Upload button for selected stage */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => document.getElementById('route-image-upload-stage')?.click()}
          disabled={isUploading}
        >
          <Upload className="h-4 w-4 mr-2" />
          {isUploading ? 'Téléchargement...' : getImageForStage(selectedStage) ? 'Remplacer' : 'Ajouter'}
          {selectedStage !== null ? ` Étape ${selectedStage}` : ' Vue d\'ensemble'}
        </Button>
      </div>

      {/* Thumbnails of existing images */}
      {existingImages.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {existingImages.map((img) => (
            <div 
              key={img.etape_numero ?? 'overview'} 
              className="relative w-16 h-16 rounded-md overflow-hidden border cursor-pointer"
              onClick={() => setSelectedStage(img.etape_numero)}
            >
              <img src={img.image_url} alt={img.label || ''} className="w-full h-full object-cover" />
              <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[9px] text-center py-0.5">
                {img.etape_numero ? `É${img.etape_numero}` : 'VE'}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}