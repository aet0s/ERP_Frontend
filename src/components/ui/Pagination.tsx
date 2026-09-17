import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalItems: number;
  pageSize?: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export function Pagination({
  currentPage,
  totalItems,
  pageSize = 20,
  onPageChange,
  className = ''
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

  const startItem = totalItems === 0 ? 0 : (safeCurrentPage - 1) * pageSize + 1;
  const endItem = Math.min(safeCurrentPage * pageSize, totalItems);

  // Generate visible page numbers
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (safeCurrentPage > 3) pages.push('...');

      const start = Math.max(2, safeCurrentPage - 1);
      const end = Math.min(totalPages - 1, safeCurrentPage + 1);

      for (let i = start; i <= end; i++) {
        if (!pages.includes(i)) pages.push(i);
      }

      if (safeCurrentPage < totalPages - 2) pages.push('...');
      if (!pages.includes(totalPages)) pages.push(totalPages);
    }
    return pages;
  };

  const pages = getPageNumbers();

  return (
    <div
      className={`flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 bg-slate-50/80 border-t border-slate-200/90 text-xs select-none ${className}`}
    >
      {/* Left: Summary Strip */}
      <div className="flex items-center gap-2 text-slate-600">
        <span>
          Showing <strong className="font-semibold text-slate-900">{startItem}</strong> to{' '}
          <strong className="font-semibold text-slate-900">{endItem}</strong> of{' '}
          <strong className="font-semibold text-slate-900">{totalItems}</strong> entries
        </span>
        <span className="hidden sm:inline-block text-slate-300">|</span>
        <span className="hidden sm:inline-block text-slate-500 font-medium">
          Fixed <span className="font-semibold text-slate-700">{pageSize}</span> / page
        </span>
      </div>

      {/* Right: Navigation Buttons */}
      <div className="flex items-center gap-1">
        {/* First Page */}
        <button
          type="button"
          disabled={safeCurrentPage <= 1}
          onClick={() => onPageChange(1)}
          title="First Page"
          className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none transition cursor-pointer shadow-2xs"
        >
          <ChevronsLeft size={15} />
        </button>

        {/* Previous Page */}
        <button
          type="button"
          disabled={safeCurrentPage <= 1}
          onClick={() => onPageChange(safeCurrentPage - 1)}
          title="Previous Page"
          className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none transition cursor-pointer shadow-2xs"
        >
          <ChevronLeft size={15} />
        </button>

        {/* Page Numbers */}
        <div className="flex items-center gap-1 mx-1">
          {pages.map((p, idx) => {
            if (p === '...') {
              return (
                <span key={`ellipsis-${idx}`} className="w-8 h-8 flex items-center justify-center text-slate-400 font-bold">
                  ...
                </span>
              );
            }

            const pageNum = Number(p);
            const isActive = pageNum === safeCurrentPage;

            return (
              <button
                key={`page-${pageNum}`}
                type="button"
                onClick={() => onPageChange(pageNum)}
                className={`w-8 h-8 rounded-lg text-xs font-bold transition cursor-pointer shadow-2xs flex items-center justify-center ${
                  isActive
                    ? 'bg-blue-600 text-white border border-blue-600 shadow-sm'
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                {pageNum}
              </button>
            );
          })}
        </div>

        {/* Next Page */}
        <button
          type="button"
          disabled={safeCurrentPage >= totalPages}
          onClick={() => onPageChange(safeCurrentPage + 1)}
          title="Next Page"
          className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none transition cursor-pointer shadow-2xs"
        >
          <ChevronRight size={15} />
        </button>

        {/* Last Page */}
        <button
          type="button"
          disabled={safeCurrentPage >= totalPages}
          onClick={() => onPageChange(totalPages)}
          title="Last Page"
          className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none transition cursor-pointer shadow-2xs"
        >
          <ChevronsRight size={15} />
        </button>
      </div>
    </div>
  );
}
