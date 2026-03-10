import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

interface UsePaginatedQueryOptions<T> {
  queryKey: (string | number | null | undefined)[];
  fetchFn: (from: number, to: number) => Promise<{ data: T[]; count: number | null }>;
  pageSize?: number;
  enabled?: boolean;
  staleTime?: number;
}

export function usePaginatedQuery<T>({
  queryKey,
  fetchFn,
  pageSize = 20,
  enabled = true,
  staleTime,
}: UsePaginatedQueryOptions<T>) {
  const [page, setPage] = useState(0);
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: [...queryKey, "page", page, pageSize],
    queryFn: async () => {
      const from = page * pageSize;
      const to = from + pageSize - 1;
      return fetchFn(from, to);
    },
    enabled,
    staleTime,
    placeholderData: (prev) => prev, // keepPreviousData equivalent
  });

  const totalPages = query.data?.count
    ? Math.ceil(query.data.count / pageSize)
    : undefined;

  const goToPage = useCallback((p: number) => setPage(p), []);
  const nextPage = useCallback(() => setPage((p) => p + 1), []);
  const prevPage = useCallback(() => setPage((p) => Math.max(0, p - 1)), []);

  return {
    data: query.data?.data ?? [],
    totalCount: query.data?.count ?? 0,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    page,
    totalPages,
    pageSize,
    hasNextPage: totalPages !== undefined ? page < totalPages - 1 : false,
    hasPrevPage: page > 0,
    nextPage,
    prevPage,
    goToPage,
  };
}
