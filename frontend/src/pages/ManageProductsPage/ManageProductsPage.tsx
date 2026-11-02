import { ManagePlaceholder } from '@features/manage-catalog'
import { APP_ROUTES } from '@shared/config'
import { MANAGE_COPY } from '@shared/lib/copy'

export function ManageProductsPage() {
  return (
    <ManagePlaceholder
      title={MANAGE_COPY.productsTitle}
      description={MANAGE_COPY.productsDescription}
      to={APP_ROUTES.manageProductNew}
      linkLabel={MANAGE_COPY.newProduct}
    />
  )
}
