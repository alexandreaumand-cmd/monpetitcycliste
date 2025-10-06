import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface RouteImageUploaderProps {
  startlistId: string;
  currentImageUrl: string | null;
  onUploadComplete: (url: string) => void;
}

export function RouteImageUploader({ startlistId, currentImageUrl, onUploadComplete }: RouteImageUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Format non supporté", {
        description: "Veuillez utiliser PNG, JPG ou WebP"
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Fichier trop volumineux", {
        description: "La taille maximale est de 5 MB"
      });
      return;
    }

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('startlist_id', startlistId);
      formData.append('file', file);

      // Get session for auth token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Vous devez être connecté");
        return;
      }

      // Use direct fetch with proper multipart/form-data handling
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/startlist-upload-route-image`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
          body: formData,
        }
      );

      const json = await response.json();
      
      if (!response.ok) {
        throw new Error(json?.error || 'Upload failed');
      }

      if (json?.route_image_url) {
        onUploadComplete(json.route_image_url);
        toast.success("Image téléchargée", {
          description: "L'image du parcours a été mise à jour"
        });
      }
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error("Erreur lors du téléchargement", {
        description: error.message || "Une erreur s'est produite"
      });
    } finally {
      setIsUploading(false);
      // Reset input
      e.target.value = '';
    }
  };

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
        {isUploading ? 'Téléchargement...' : currentImageUrl ? 'Modifier l\'image' : 'Ajouter une image'}
      </Button>
    </div>
  );
}
