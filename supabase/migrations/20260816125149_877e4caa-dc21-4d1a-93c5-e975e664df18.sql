DO $$
BEGIN
  PERFORM set_config('request.jwt.claims', '{"sub":"613c0989-a933-4ce7-b7ac-17ddd80ed171","role":"authenticated"}', true);
  PERFORM public.admin_compute_points_for_course('czech_tour');
END $$;