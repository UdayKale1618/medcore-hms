import React, { createContext, useContext } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const TableRowContext = createContext<boolean>(false);

export interface TableProps extends React.TableHTMLAttributes<HTMLTableElement> {
  padding?: 'compact' | 'normal';
  minWidth?: string;
  containerClassName?: string;
}

export const Table: React.FC<TableProps> = ({
  className = '',
  containerClassName = '',
  padding = 'normal',
  minWidth = '750px',
  children,
  style,
  ...props
}) => {
  const paddingClass =
    padding === 'compact'
      ? '[&_td]:py-2.5 [&_td]:px-3.5 [&_th]:py-2.5 [&_th]:px-3.5'
      : '[&_td]:py-3.5 [&_td]:px-4 [&_th]:py-3.5 [&_th]:px-4';

  return (
    <div
      className={`w-full overflow-x-auto rounded-2xl border border-[#EEF2F6] bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)] ${containerClassName}`}
    >
      <table
        className={`w-full text-left text-sm border-collapse ${paddingClass} ${className}`}
        style={{ minWidth, ...style }}
        {...props}
      >
        {children}
      </table>
    </div>
  );
};

export const TableRow: React.FC<React.HTMLAttributes<HTMLTableRowElement>> = ({
  className = '',
  children,
  ...props
}) => {
  return (
    <TableRowContext.Provider value={true}>
      <tr
        className={`border-b border-[#EEF2F6] last:border-b-0 hover:bg-[#F8FAFC] transition-colors ${className}`}
        {...props}
      >
        {children}
      </tr>
    </TableRowContext.Provider>
  );
};

export const TableBody: React.FC<
  React.HTMLAttributes<HTMLTableSectionElement>
> = ({ className = '', children, ...props }) => {
  return (
    <tbody
      className={`divide-y divide-[#EEF2F6] bg-white ${className}`}
      {...props}
    >
      {children}
    </tbody>
  );
};

export const TableCellHead: React.FC<
  React.ThHTMLAttributes<HTMLTableCellElement>
> = ({ className = '', children, ...props }) => {
  return (
    <th
      className={`text-xs font-semibold text-[#64748B] whitespace-nowrap align-middle ${className}`}
      {...props}
    >
      {children}
    </th>
  );
};

export const TableSectionHead: React.FC<
  React.HTMLAttributes<HTMLTableSectionElement>
> = ({ className = '', children, ...props }) => {
  return (
    <thead
      className={`bg-[#F8FAFC] border-b border-[#EEF2F6] text-xs font-semibold text-[#64748B] ${className}`}
      {...props}
    >
      {children}
    </thead>
  );
};

export type TableHeaderProps = React.ThHTMLAttributes<HTMLTableCellElement> &
  React.HTMLAttributes<HTMLTableSectionElement>;

/**
 * Universal TableHeader:
 * If used inside a TableRow (as a column header cell), renders <th>.
 * If used outside a TableRow (as the table section wrapper), renders <thead>.
 * This guarantees resilience against legacy and inverted naming in various modules.
 */
export const TableHeader: React.FC<TableHeaderProps> = ({
  className = '',
  children,
  ...props
}) => {
  const isInsideRow = useContext(TableRowContext);

  if (isInsideRow) {
    return (
      <th
        className={`text-xs font-semibold text-[#64748B] whitespace-nowrap align-middle ${className}`}
        {...props}
      >
        {children}
      </th>
    );
  }

  return (
    <thead
      className={`bg-[#F8FAFC] border-b border-[#EEF2F6] text-xs font-semibold text-[#64748B] ${className}`}
      {...props}
    >
      {children}
    </thead>
  );
};

/**
 * Universal TableHead:
 * If used inside a TableRow, renders <th>.
 * If used outside a TableRow (wrapping TableRow), renders <thead>.
 */
export const TableHead: React.FC<TableHeaderProps> = ({
  className = '',
  children,
  ...props
}) => {
  const isInsideRow = useContext(TableRowContext);

  if (isInsideRow) {
    return (
      <th
        className={`text-xs font-semibold text-[#64748B] whitespace-nowrap align-middle ${className}`}
        {...props}
      >
        {children}
      </th>
    );
  }

  return (
    <thead
      className={`bg-[#F8FAFC] border-b border-[#EEF2F6] text-xs font-semibold text-[#64748B] ${className}`}
      {...props}
    >
      {children}
    </thead>
  );
};

export const TableCell: React.FC<
  React.TdHTMLAttributes<HTMLTableCellElement>
> = ({ className = '', children, ...props }) => {
  return (
    <td
      className={`text-[#334155] text-sm align-middle ${className}`}
      {...props}
    >
      {children}
    </td>
  );
};

export interface PaginationProps {
  currentPage: number;
  totalPages?: number;
  totalItems?: number;
  pageSize?: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export const TablePagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  totalItems,
  pageSize = 10,
  onPageChange,
  className = '',
}) => {
  const computedTotalPages =
    totalPages ?? Math.max(1, Math.ceil((totalItems || 0) / (pageSize || 10)));

  if (computedTotalPages <= 1 && (!totalItems || totalItems <= pageSize)) return null;

  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = totalItems
    ? Math.min(currentPage * pageSize, totalItems)
    : currentPage * pageSize;

  return (
    <div
      className={`flex items-center justify-between px-4 py-3 bg-white border-t border-[#EEF2F6] sm:px-6 ${className}`}
    >
      <div className="flex justify-between flex-1 sm:hidden">
        <button
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage <= 1}
          className="relative inline-flex items-center px-3 py-1.5 text-xs font-medium text-[#334155] bg-white border border-[#E5E7EB] rounded-[10px] hover:bg-[#F8FAFC] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Previous
        </button>
        <button
          onClick={() => onPageChange(Math.min(computedTotalPages, currentPage + 1))}
          disabled={currentPage >= computedTotalPages}
          className="relative inline-flex items-center px-3 py-1.5 ml-3 text-xs font-medium text-[#334155] bg-white border border-[#E5E7EB] rounded-[10px] hover:bg-[#F8FAFC] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Next
        </button>
      </div>

      <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
        <div>
          <p className="text-xs text-[#64748B]">
            Showing <span className="font-semibold text-[#111827]">{startItem}</span> to{' '}
            <span className="font-semibold text-[#111827]">{endItem}</span>
            {totalItems ? (
              <>
                {' '}
                of <span className="font-semibold text-[#111827]">{totalItems}</span> results
              </>
            ) : null}
          </p>
        </div>

        <div>
          <nav
            className="relative z-0 inline-flex items-center gap-1"
            aria-label="Pagination"
          >
            <button
              onClick={() => onPageChange(Math.max(1, currentPage - 1))}
              disabled={currentPage <= 1}
              className="relative inline-flex items-center p-1.5 text-xs font-medium text-[#64748B] bg-white border border-[#E5E7EB] rounded-[8px] hover:bg-[#F8FAFC] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <span className="sr-only">Previous</span>
              <ChevronLeft className="w-4 h-4" />
            </button>

            <span className="text-xs font-medium text-[#64748B] px-2">
              Page {currentPage} of {computedTotalPages}
            </span>

            <button
              onClick={() => onPageChange(Math.min(computedTotalPages, currentPage + 1))}
              disabled={currentPage >= computedTotalPages}
              className="relative inline-flex items-center p-1.5 text-xs font-medium text-[#64748B] bg-white border border-[#E5E7EB] rounded-[8px] hover:bg-[#F8FAFC] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <span className="sr-only">Next</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </nav>
        </div>
      </div>
    </div>
  );
};
