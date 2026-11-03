import { selectCanManage, useAuthStore } from '@entities/user'
import { ManageOrders } from '@features/manage-orders'

/** Данные и локальное состояние доступны только в текущей staff-сессии. */
export function ManageOrdersPage() {
  const allowed = useAuthStore(selectCanManage)
  const generation = useAuthStore((state) => state.sessionGeneration)
  return allowed ? <ManageOrders key={generation} /> : null
}
