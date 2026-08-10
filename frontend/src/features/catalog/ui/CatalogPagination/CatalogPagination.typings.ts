/**
 * Props for catalog page-number pagination.
 */
export interface CatalogPaginationProps {
  /** Current 1-based page. */
  page: number
  /** Total number of items across all pages. */
  count: number
  /** Items per page. */
  pageSize: number
  /** Called when the user picks another page. */
  onPageChange: (page: number) => void
  /** Optional extra class name. */
  className?: string
}
