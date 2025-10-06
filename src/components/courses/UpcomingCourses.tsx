import { useIsMobile } from "@/hooks/use-mobile";
import { UpcomingCoursesMobile } from "./UpcomingCourses.mobile";
import { UpcomingCourses as UpcomingCoursesDesktop } from "./UpcomingCourses.desktop";

export const UpcomingCourses = () => {
  const isMobile = useIsMobile();
  return isMobile ? <UpcomingCoursesMobile /> : <UpcomingCoursesDesktop />;
};
