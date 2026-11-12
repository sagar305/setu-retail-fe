import { ChevronLeft, ChevronRight } from "lucide-react";
import { PAGE_SIZES } from "../hooks/usePageSize";

/**
 * "21–40 of 2,000" with previous/next and rows per page. `page` counts from 0.
 * Hidden when there's nothing to page through.
 */
export function Pagination({ page, pageSize, total, onPage, onPageSize, noun = "rows" }: { page: number; pageSize: number; total: number; onPage: (page: number) => void; onPageSize: (size: number) => void; noun?: string }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total === 0) return null;
  const first = page * pageSize + 1;
  const last = Math.min(total, (page + 1) * pageSize);
  const nav = "flex size-11 items-center justify-center rounded-[10px] border border-line-strong bg-white text-ink disabled:opacity-40";
  return (
    <nav aria-label="Pages" className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm">
      <p className="m-0 text-muted" aria-live="polite">
        <span className="font-semibold text-ink tabular-nums">
          {first.toLocaleString("en-IN")}–{last.toLocaleString("en-IN")}
        </span>{" "}
        of <span className="tabular-nums">{total.toLocaleString("en-IN")}</span> {noun}
      </p>
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-2 text-muted">
          <span className="max-sm:sr-only">Per page</span>
          <select
            value={pageSize}
            onChange={(e) => onPageSize(Number(e.target.value))}
            className="h-11 rounded-[10px] border border-line-strong bg-white px-2 text-ink"
            aria-label="Rows per page"
          >
            {PAGE_SIZES.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className={nav} aria-label="Previous page" disabled={page === 0} onClick={() => onPage(page - 1)}>
          <ChevronLeft size={18} aria-hidden="true" />
        </button>
        <span className="min-w-[88px] text-center tabular-nums">
          Page {page + 1} of {pages.toLocaleString("en-IN")}
        </span>
        <button type="button" className={nav} aria-label="Next page" disabled={page >= pages - 1} onClick={() => onPage(page + 1)}>
          <ChevronRight size={18} aria-hidden="true" />
        </button>
      </div>
    </nav>
  );
}
