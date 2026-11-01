import type { PaginationState } from "../hooks/usePagination";

interface PaginationProps<T> {
  pagination: PaginationState<T>;
  /** Noun for the summary, e.g. "tasks". */
  label: string;
  compact?: boolean;
}

export function Pagination<T>({ pagination, label, compact = false }: PaginationProps<T>) {
  const { page, pageCount, start, end, total, setPage } = pagination;
  if (pageCount <= 1) return null;

  return (
    <nav className={`pagination${compact ? " compact" : ""}`} aria-label={`${label} pages`}>
      <button type="button" onClick={() => setPage(page - 1)} disabled={page === 1} aria-label="Previous page">
        <span aria-hidden="true">←</span>{!compact && " Prev"}
      </button>
      <span className="pagination-summary" aria-live="polite">
        {compact ? `${page}/${pageCount}` : `${start}–${end} of ${total} ${label}`}
      </span>
      <button type="button" onClick={() => setPage(page + 1)} disabled={page === pageCount} aria-label="Next page">
        {!compact && "Next "}<span aria-hidden="true">→</span>
      </button>
    </nav>
  );
}
