import type { ManageProduct, ProductChange } from '../../api/manageCatalogApi'

export interface ManageProductRowProps {
  /** Товар из staff-списка. */
  product: ManageProduct
  /** Сохранение полей товара. */
  onSave: (change: ProductChange) => Promise<unknown>
}
