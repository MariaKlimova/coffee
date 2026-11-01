/**
 * Props for the header search form.
 */
export interface HeaderSearchProps {
  /** Поисковый запрос из URL каталога. */
  query?: string
  /** Ключ записи истории для восстановления поля при навигации. */
  locationKey?: string
  /** Доступное имя формы с текущей областью поиска. */
  scope?: string
  /** Применение текста сразу после ввода, а для IME — по завершении композиции. */
  onChange?: (query: string) => void
  /** Очистка поискового запроса в URL. */
  onClear?: () => void
  /** Called with the trimmed query on submit. */
  onSubmit?: (query: string) => void
  /** Optional extra class name. */
  className?: string
}
