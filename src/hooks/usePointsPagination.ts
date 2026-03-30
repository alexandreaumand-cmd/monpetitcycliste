import { useState, useMemo } from "react";

export const usePointsPagination = <T>(data: T[], pageSize: number = 50) => {
  const [page, setPage] = useState(0);

  const paginatedData = useMemo(() => {
    const start = page * pageSize;
    return data.slice(start, start + pageSize);
  }, [data, page, pageSize]);

  const totalPages = Math.ceil(data.length / pageSize);
  const hasNextPage = (page + 1) * pageSize < data.length;
  const hasPrevPage = page > 0;

  const nextPage = () => setPage(p => p + 1);
  const prevPage = () => setPage(p => p - 1);
  const resetPage = () => setPage(0);

  return {
    page,
    setPage,
    paginatedData,
    totalPages,
    hasNextPage,
    hasPrevPage,
    nextPage,
    prevPage,
    resetPage,
    pageSize,
  };
};
