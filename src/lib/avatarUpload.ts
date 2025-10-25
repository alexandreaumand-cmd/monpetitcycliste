import { supabase } from "@/integrations/supabase/client";

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export async function uploadManagerAvatar(file: File, userId: string): Promise<string> {
  // Validate file type
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error('Type de fichier non supporté. Utilisez JPG, PNG ou WEBP.');
  }

  // Validate file size
  if (file.size > MAX_FILE_SIZE) {
    throw new Error('Le fichier est trop volumineux. Maximum 2MB.');
  }

  // Get file extension
  const fileExt = file.name.split('.').pop();
  const filePath = `${userId}/avatar.${fileExt}`;

  // Delete existing avatar if any
  await supabase.storage
    .from('manager-avatars')
    .remove([filePath]);

  // Upload new avatar
  const { error: uploadError } = await supabase.storage
    .from('manager-avatars')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: true
    });

  if (uploadError) {
    throw uploadError;
  }

  // Get public URL
  const { data } = supabase.storage
    .from('manager-avatars')
    .getPublicUrl(filePath);

  return data.publicUrl;
}

export async function deleteManagerAvatar(userId: string): Promise<void> {
  // List all files in user's folder
  const { data: files } = await supabase.storage
    .from('manager-avatars')
    .list(userId);

  if (!files || files.length === 0) {
    return;
  }

  // Delete all files
  const filePaths = files.map(file => `${userId}/${file.name}`);
  const { error } = await supabase.storage
    .from('manager-avatars')
    .remove(filePaths);

  if (error) {
    throw error;
  }
}
