import { selectCanManage, useAuthStore } from '@entities/user'
import { ManageOrderDetail } from '@features/manage-orders'

/** Данные и локальное состояние доступны только в текущей staff-сессии. */
export function ManageOrderDetailPage() {
  const allowed = useAuthStore(selectCanManage)
  const generation = useAuthStore((state) => state.sessionGeneration)
  return allowed ? <ManageOrderDetail key={generation} /> : null
}
