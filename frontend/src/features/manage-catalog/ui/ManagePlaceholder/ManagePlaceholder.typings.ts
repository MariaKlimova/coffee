/** Содержимое временной страницы управления. */
export interface ManagePlaceholderProps {
  /** Заголовок страницы. */
  title: string
  /** Честное описание доступных возможностей. */
  description: string
  /** Внутренний адрес следующего шага. */
  to: string
  /** Подпись ссылки следующего шага. */
  linkLabel: string
}
