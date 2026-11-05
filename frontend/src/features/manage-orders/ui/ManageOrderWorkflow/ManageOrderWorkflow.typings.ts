import type { ManageOrder } from '../../api/manageOrdersApi.typings'

export interface ManageOrderWorkflowProps {
  /** Текущее состояние заказа из staff API. */
  order: ManageOrder
  /** Выполняется проверка актуального состояния. */
  refreshing: boolean
  /** Повторно загружает заказ перед новым действием. */
  refresh: () => Promise<unknown>
}
