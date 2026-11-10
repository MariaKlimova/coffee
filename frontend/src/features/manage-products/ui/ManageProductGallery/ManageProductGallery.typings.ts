import type { ManageProduct, ManageProductImage } from '../../api/manageCatalogApi'

export interface ManageProductGalleryProps {
  /** Сохранённый товар; до создания загрузка недоступна. */
  product?: ManageProduct
  /** Обновление данных или ошибка чтения временно блокируют изменения фото. */
  disabled?: boolean
  /** Перечитать данные после ошибки; true означает успешное обновление. */
  onRefresh: () => Promise<boolean>
}

export interface ProductGalleryImageProps {
  /** Сохранённая фотография. */
  image: ManageProductImage
  /** Название товара для альтернативного текста. */
  name: string
  /** Позиция в отображаемом списке, начиная с нуля. */
  position: number
  /** Общее количество фотографий. */
  count: number
  /** Действия недоступны во время запроса или для демо-товара. */
  disabled: boolean
  /** Временное демо-фото своего товара не показывается на витрине. */
  mockHidden: boolean
  /** Для этой фотографии открыто подтверждение удаления. */
  confirming: boolean
  /** Выбрать эту фотографию главной. */
  onMain: () => void
  /** Переместить фотографию в указанную позицию. */
  onMove: (position: number) => void
  /** Показать подтверждение удаления. */
  onAskRemove: () => void
  /** Оставить фотографию. */
  onCancelRemove: () => void
  /** Подтвердить удаление фотографии. */
  onRemove: () => void
}
