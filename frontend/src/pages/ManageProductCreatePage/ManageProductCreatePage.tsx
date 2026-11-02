import { ManagePlaceholder } from '@features/manage-catalog'
import { APP_ROUTES } from '@shared/config'
import { MANAGE_COPY } from '@shared/lib/copy'

export function ManageProductCreatePage() {
  return (
    <ManagePlaceholder
      title={MANAGE_COPY.newTitle}
      description={MANAGE_COPY.newDescription}
      to={APP_ROUTES.manageProducts}
      linkLabel={MANAGE_COPY.backToProducts}
    />
  )
}
