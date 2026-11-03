import type { ManageOrderListItem } from '../../api/manageOrdersApi.typings'

export interface ManageOrderRowProps {
  /** Строка списка заказов магазина. */
  order: ManageOrderListItem
  /** Текущие фильтры списка для возврата из карточки. */
  search: string
}
