import { Link } from 'react-router-dom'

import { APP_ROUTES } from '@shared/config'
import { MANAGE_COPY } from '@shared/lib/copy'
import { EmptyState } from '@shared/ui/EmptyState'

import styles from './ManageAccessDeniedPage.module.css'

export function ManageAccessDeniedPage() {
  return (
    <main className={styles.ManageAccessDeniedPage}>
      <EmptyState
        title={MANAGE_COPY.deniedTitle}
        description={MANAGE_COPY.deniedDescription}
        action={<Link to={APP_ROUTES.coffee}>{MANAGE_COPY.storefront}</Link>}
      />
    </main>
  )
}
