import {
  MANAGE_COPY,
  PRODUCT_FORM_COPY as COPY,
  PRODUCT_GALLERY_COPY,
} from '@shared/lib/copy'
import { APP_ROUTES } from '@shared/config'
import { isNotFoundError } from '@shared/api'
import { Button } from '@shared/ui/Button'
import { useManageProductForm } from '../../model/useManageProductForm'
import { ManageProductFields } from './-Fields'
import { ManageProductGallery } from '../ManageProductGallery'
import type { ManageProductFormProps } from './ManageProductForm.typings'
import styles from './ManageProductForm.module.css'

export function ManageProductForm({ id }: ManageProductFormProps) {
  const { product, enabled, formKey, save } = useManageProductForm(id)
  if (!enabled) return null
  if (id && product.isPending) return <p role="status">{COPY.loading}</p>
  if (id && product.isError && !product.data)
    return (
      <section className={styles.ManageProductForm}>
        <h1>{isNotFoundError(product.error) ? COPY.notFound : COPY.loadError}</h1>
        <div className={styles['ManageProductForm-Actions']}>
          <Button onClick={() => void product.refetch()}>{COPY.retry}</Button>
          <Button to={APP_ROUTES.manageProducts} variant="ghost">
            {MANAGE_COPY.backToProducts}
          </Button>
        </div>
      </section>
    )
  return (
    <section className={styles.ManageProductForm}>
      <header>
        <h1>{id ? MANAGE_COPY.editTitle : MANAGE_COPY.newTitle}</h1>
        <p>{id ? MANAGE_COPY.editDescription : MANAGE_COPY.newDescription}</p>
      </header>
      {product.isRefetchError && (
        <div role="alert" className={styles['ManageProductForm-Notice']}>
          <p>{PRODUCT_GALLERY_COPY.refreshError}</p>
          <Button variant="secondary" onClick={() => void product.refetch()}>
            {COPY.retry}
          </Button>
        </div>
      )}
      <ManageProductGallery
        key={`gallery:${formKey}`}
        product={product.data}
        disabled={product.isFetching || product.isRefetchError}
        onRefresh={async () => !(await product.refetch()).isError}
      />
      <ManageProductFields key={formKey} product={product.data} onSave={save} />
    </section>
  )
}
