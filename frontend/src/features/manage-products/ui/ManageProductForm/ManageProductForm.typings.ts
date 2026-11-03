import type { ManageProduct, ProductFormWrite } from '../../api/manageCatalogApi'
export interface ManageProductFormProps {
  /** Идентификатор редактируемого товара; отсутствует при создании. */
  id?: string
}
export interface ManageProductFieldsProps {
  /** Сохранённые данные редактируемого товара. */
  product?: ManageProduct
  /** Сохранение в контексте текущей staff-сессии. */
  onSave: (values: ProductFormWrite) => Promise<ManageProduct>
}
