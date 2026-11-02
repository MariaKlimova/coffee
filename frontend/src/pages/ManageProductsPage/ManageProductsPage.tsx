import { selectCanManage, useAuthStore } from '@entities/user'
import { ManageProducts } from '@features/manage-products'

export function ManageProductsPage() {
  const allowed = useAuthStore(selectCanManage)
  const generation = useAuthStore((state) => state.sessionGeneration)
  return allowed ? <ManageProducts key={generation} /> : null
}
