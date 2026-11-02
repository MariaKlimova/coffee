import { ManagePlaceholder } from '@features/manage-catalog'
import { APP_ROUTES } from '@shared/config'
import { MANAGE_COPY } from '@shared/lib/copy'

export function ManagePage() {
  return (
    <ManagePlaceholder
      title={MANAGE_COPY.homeTitle}
      description={MANAGE_COPY.homeDescription}
      to={APP_ROUTES.manageProducts}
      linkLabel={MANAGE_COPY.openProducts}
    />
  )
}
