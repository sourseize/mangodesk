import { useEffect, useMemo, useState } from "react";

export interface PaginationState<T> {
  page: number;
  pageCount: number;
  pageItems: T[];
  /** 1-based index of the first and last item on the page (0 when empty). */
  start: number;
  end: number;
  total: number;
  setPage: (page: number) => void;
}

/** Client-side paging; clamps the page when the list shrinks. */
export function usePagination<T>(items: T[], pageSize: number): PaginationState<T> {
  const [page, setPage] = useState(1);
  const total = items.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  const current = Math.min(page, pageCount);
  const pageItems = useMemo(
    () => items.slice((current - 1) * pageSize, current * pageSize),
    [items, current, pageSize],
  );

  return {
    page: current,
    pageCount,
    pageItems,
    start: total === 0 ? 0 : (current - 1) * pageSize + 1,
    end: Math.min(current * pageSize, total),
    total,
    setPage: (next) => setPage(Math.min(Math.max(1, next), pageCount)),
  };
}
