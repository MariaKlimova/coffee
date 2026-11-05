import type { ManageOrder } from '../../api/manageOrdersApi.typings'

export interface ManageOrderWorkflowProps {
  /** Текущее состояние заказа из staff API. */
  order: ManageOrder
  /** Выполняется проверка актуального состояния. */
  refreshing: boolean
  /** Последняя проверка заказа прошла успешно; новые действия разрешены. */
  verified: boolean
  /** Проверяет заказ; true только при успешном чтении актуального состояния. */
  refresh: () => Promise<boolean>
  /** Закрывает приватную карточку после подтверждённого отказа доступа. */
  onUnavailable: (status: 401 | 403 | 404) => void
}
