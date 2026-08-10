/**
 * Props for the header search form.
 */
export interface HeaderSearchProps {
  /** Called with the trimmed query on submit. */
  onSubmit?: (query: string) => void
  /** Optional extra class name. */
  className?: string
}
