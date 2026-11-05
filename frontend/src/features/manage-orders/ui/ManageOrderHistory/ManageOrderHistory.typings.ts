import type { OrderStatusHistoryEntry } from '../../api/manageOrdersApi.typings'

export interface ManageOrderHistoryProps {
  /** Реальные события обработки, упорядоченные сервером. */
  entries: OrderStatusHistoryEntry[]
}
