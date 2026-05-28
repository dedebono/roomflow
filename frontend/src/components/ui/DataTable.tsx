import React, { ReactNode } from 'react';

interface Column<T> {
  header: string;
  accessor?: keyof T | ((row: T) => ReactNode);
  cell?: (row: T) => ReactNode;
  className?: string;
  /** If true, this column is hidden on mobile card view */
  mobileHidden?: boolean;
  /** If true, this column is shown as the card title on mobile */
  mobileTitle?: boolean;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  emptyMessage?: string;
  isLoading?: boolean;
}

export function DataTable<T>({
  columns,
  data,
  emptyMessage = 'No records found.',
  isLoading = false,
}: DataTableProps<T>) {
  const getCellContent = (col: Column<T>, row: T): ReactNode => {
    if (col.cell) return col.cell(row);
    if (col.accessor) {
      if (typeof col.accessor === 'function') return col.accessor(row);
      return row[col.accessor] as unknown as ReactNode;
    }
    return '';
  };

  const loadingSpinner = (
    <div className="flex items-center justify-center gap-2 text-indigo-400 font-medium py-12">
      <svg className="animate-spin h-5 w-5 text-indigo-500" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
      </svg>
      <span>Loading data...</span>
    </div>
  );

  const emptyState = (
    <div className="py-12 text-center text-slate-500 font-medium">{emptyMessage}</div>
  );

  return (
    <>
      {/* ── Desktop table (md+) ── */}
      <div className="hidden md:block w-full overflow-x-auto rounded-xl border border-slate-800/40 glass">
        <table className="w-full border-collapse text-left text-sm text-slate-300">
          <thead className="bg-slate-900/50 text-xs font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-800/40">
            <tr>
              {columns.map((col, idx) => (
                <th key={idx} scope="col" className={`px-6 py-4 ${col.className || ''}`}>
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/20">
            {isLoading ? (
              <tr>
                <td colSpan={columns.length} className="px-6 py-12 text-center">
                  {loadingSpinner}
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-6 py-12 text-center text-slate-500 font-medium">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((row, rowIdx) => (
                <tr key={rowIdx} className="hover:bg-slate-900/30 transition-colors">
                  {columns.map((col, colIdx) => (
                    <td key={colIdx} className={`px-6 py-4 whitespace-nowrap ${col.className || ''}`}>
                      {getCellContent(col, row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ── Mobile card list (< md) ── */}
      <div className="md:hidden space-y-3">
        {isLoading ? (
          <div className="rounded-xl border border-slate-800/40 glass p-4">{loadingSpinner}</div>
        ) : data.length === 0 ? (
          <div className="rounded-xl border border-slate-800/40 glass p-4">{emptyState}</div>
        ) : (
          data.map((row, rowIdx) => {
            const titleCol = columns.find((c) => c.mobileTitle) ?? columns[0];
            const bodyColumns = columns.filter((c) => !c.mobileHidden && c !== titleCol);
            const actionsCol = columns.find(
              (c) => c.header.toLowerCase() === 'actions' || c.header.toLowerCase() === 'action'
            );
            const displayCols = bodyColumns.filter((c) => c !== actionsCol);

            return (
              <div
                key={rowIdx}
                className="rounded-xl border border-slate-800/40 glass p-4 space-y-3"
              >
                {/* Card title row */}
                <div className="flex items-start justify-between gap-2">
                  <div className="font-semibold text-slate-100 text-sm leading-snug">
                    {getCellContent(titleCol, row)}
                  </div>
                  {actionsCol && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {getCellContent(actionsCol, row)}
                    </div>
                  )}
                </div>

                {/* Key-value pairs */}
                {displayCols.length > 0 && (
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                    {displayCols.map((col, colIdx) => (
                      <div key={colIdx} className="min-w-0">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-0.5">
                          {col.header}
                        </p>
                        <div className="text-xs text-slate-300 truncate">
                          {getCellContent(col, row)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </>
  );
}
