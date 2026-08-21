import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CourseRouteImage {
  etape_numero: number | null;
  image_url: string;
  label: string | null;
}

/** Route images (profils/parcours) for a course, cached for reuse across cards. */
export function useCourseRouteImages(courseId?: string | null, enabled = true) {
  return useQuery({
    queryKey: ["course-route-images", courseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("course_route_images")
        .select("etape_numero, image_url, label")
        .eq("course_id", courseId!);
      if (error) throw error;
      return (data ?? []) as CourseRouteImage[];
    },
    enabled: !!courseId && enabled,
    staleTime: 5 * 60 * 1000,
  });
}

/** Best matching image: exact stage first, then course overview (etape_numero null). */
export function pickRouteImage(
  images: CourseRouteImage[] | undefined,
  etapeNumero?: number | null
): CourseRouteImage | null {
  if (!images || images.length === 0) return null;
  if (etapeNumero != null) {
    const match = images.find((img) => img.etape_numero === etapeNumero);
    if (match) return match;
    return null;
  }
  return images.find((img) => img.etape_numero == null) ?? null;
}
