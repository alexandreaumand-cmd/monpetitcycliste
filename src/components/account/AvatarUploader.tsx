import { useState, useRef } from "react";
import { Camera, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { uploadManagerAvatar, deleteManagerAvatar } from "@/lib/avatarUpload";

interface AvatarUploaderProps {
  currentAvatarUrl?: string;
  managerName: string;
  userId: string;
  onAvatarChange: (newUrl: string | null) => void;
}

export function AvatarUploader({ 
  currentAvatarUrl, 
  managerName, 
  userId,
  onAvatarChange 
}: AvatarUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewUrl(reader.result as string);
    };
    reader.readAsDataURL(file);

    setUploading(true);
    try {
      // Upload to storage
      const publicUrl = await uploadManagerAvatar(file, userId);

      // Update manager's avatar_url in database
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Non authentifié');

      const { data: manager } = await supabase
        .from('managers')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!manager) throw new Error('Manager non trouvé');

      const { error: updateError } = await supabase
        .from('managers')
        .update({ avatar_url: publicUrl })
        .eq('id', manager.id);

      if (updateError) throw updateError;

      onAvatarChange(publicUrl);
      toast({
        title: "Photo mise à jour",
        description: "Votre photo de profil a été mise à jour avec succès.",
      });
    } catch (error: any) {
      console.error('Error uploading avatar:', error);
      toast({
        title: "Erreur",
        description: error.message || "Impossible de télécharger la photo.",
        variant: "destructive",
      });
      setPreviewUrl(null);
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDeleteAvatar = async () => {
    setDeleting(true);
    try {
      await deleteManagerAvatar(userId);

      // Update manager's avatar_url to null
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Non authentifié');

      const { data: manager } = await supabase
        .from('managers')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!manager) throw new Error('Manager non trouvé');

      const { error: updateError } = await supabase
        .from('managers')
        .update({ avatar_url: null })
        .eq('id', manager.id);

      if (updateError) throw updateError;

      onAvatarChange(null);
      setPreviewUrl(null);
      toast({
        title: "Photo supprimée",
        description: "Votre photo de profil a été supprimée.",
      });
    } catch (error: any) {
      console.error('Error deleting avatar:', error);
      toast({
        title: "Erreur",
        description: error.message || "Impossible de supprimer la photo.",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  const displayUrl = previewUrl || currentAvatarUrl;
  const initials = managerName.substring(0, 2).toUpperCase();

  return (
    <div className="flex flex-col items-center gap-2">
      <Avatar className="h-20 w-20">
        {displayUrl ? (
          <AvatarImage src={displayUrl} alt={managerName} />
        ) : null}
        <AvatarFallback className="text-2xl">{initials}</AvatarFallback>
      </Avatar>

      <div className="flex gap-1">
        <Button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading || deleting}
          size="sm"
          variant="ghost"
          className="h-8 px-2"
        >
          <Camera className="h-4 w-4" />
        </Button>

        {currentAvatarUrl && (
          <Button
            onClick={handleDeleteAvatar}
            disabled={uploading || deleting}
            size="sm"
            variant="ghost"
            className="h-8 px-2 text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  );
}
