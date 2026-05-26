import React, { ReactNode } from 'react';

interface Column<T> {
  header: string;
  accessor?: keyof T | ((row: T) => ReactNode);
  cell?: (row: T) => ReactNode;
  className?: string;
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
  return (
    <div className="w-full overflow-x-auto rounded-xl border border-slate-800/40 glass">
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
                <div className="flex items-center justify-center gap-2 text-indigo-400 font-medium">
                  <svg className="animate-spin h-5 w-5 text-indigo-500" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Loading data...</span>
                </div>
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
                {columns.map((col, colIdx) => {
                  let content: ReactNode = '';
                  if (col.cell) {
                    content = col.cell(row);
                  } else if (col.accessor) {
                    if (typeof col.accessor === 'function') {
                      content = col.accessor(row);
                    } else {
                      content = row[col.accessor] as unknown as ReactNode;
                    }
                  }
                  return (
                    <td key={colIdx} className={`px-6 py-4.5 whitespace-nowrap ${col.className || ''}`}>
                      {content}
                    </td>
                  );
                })}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
