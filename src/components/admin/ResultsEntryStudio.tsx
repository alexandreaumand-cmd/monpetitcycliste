import { useIsMobile } from "@/hooks/use-mobile";
import { ResultsEntryStudioMobile } from "./ResultsEntryStudio.mobile";
import { ResultsEntryStudio as ResultsEntryStudioDesktop } from "./ResultsEntryStudio.desktop";

type Course = {
  course_id: string;
  course_nom: string;
  categorie: string;
  type_course: "One day" | "Stage race";
  date_debut: string;
  date_fin: string;
  nb_etapes: number;
  phase_id: string;
};

export const ResultsEntryStudio = ({
  course,
  mode,
  onClose,
}: {
  course: Course;
  mode: 'create' | 'edit';
  onClose: () => void;
}) => {
  const isMobile = useIsMobile();
  
  return isMobile ? (
    <ResultsEntryStudioMobile course={course} mode={mode} onClose={onClose} />
  ) : (
    <ResultsEntryStudioDesktop course={course} mode={mode} onClose={onClose} />
  );
};
