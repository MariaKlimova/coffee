import type { ManageOrder } from '../../api/manageOrdersApi.typings'

export interface ManageOrderCancellationRequestsProps {
  /** Текущий приватный заказ сотрудника. */
  order: ManageOrder
  /** Запрос свежего состояния уже выполняется. */
  refreshing: boolean
  /** Последнее чтение успешно проверено сервером. */
  verified: boolean
  /** Загружает актуальный заказ перед подтверждением. */
  refresh: () => Promise<ManageOrder | null>
  /** Обрабатывает отзыв доступа. */
  onUnavailable: (status: 401 | 403 | 404) => void
}
