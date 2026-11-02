import type { ManageProduct, ProductChange } from '../../api/manageCatalogApi'

export interface ManageStockEditorProps {
  /** Товар с актуальным количеством и происхождением. */
  product: ManageProduct
  /** Сохранение полей через защищённую staff-мутацию. */
  onSave: (change: ProductChange) => Promise<unknown>
  /** Закрытие редактора. */
  onClose: () => void
}
