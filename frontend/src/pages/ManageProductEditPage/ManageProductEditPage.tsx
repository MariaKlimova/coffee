import { ManagePlaceholder } from '@features/manage-catalog'
import { APP_ROUTES } from '@shared/config'
import { MANAGE_COPY } from '@shared/lib/copy'

export function ManageProductEditPage() {
  return (
    <ManagePlaceholder
      title={MANAGE_COPY.editTitle}
      description={MANAGE_COPY.editDescription}
      to={APP_ROUTES.manageProducts}
      linkLabel={MANAGE_COPY.backToProducts}
    />
  )
}
