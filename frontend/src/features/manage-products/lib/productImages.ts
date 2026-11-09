import axios from 'axios'
import { PRODUCT_GALLERY_COPY as COPY } from '@shared/lib/copy'

export const PRODUCT_IMAGE_MAX_BYTES = 4 * 1024 * 1024
export const PRODUCT_IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp'

/** Ранняя подсказка; сервер дополнительно проверяет содержимое файла. */
export function validateProductImage(file: File) {
  if (file.size > PRODUCT_IMAGE_MAX_BYTES) return COPY.tooLarge
  if (!PRODUCT_IMAGE_ACCEPT.split(',').includes(file.type)) return COPY.invalidType
  if (!file.size) return COPY.invalidImage
  return ''
}

/** Не выводит внутренние сообщения хранилища или сервера в интерфейс. */
export function productImageError(error: unknown) {
  if (!axios.isAxiosError(error)) return COPY.error
  const status = error.response?.status
  const data = error.response?.data
  if (data?.code === 'image_storage_unavailable') return COPY.storageError
  if (status === 413) return COPY.tooLarge
  if (status === 404 || data?.errors?.order || data?.errors?.is_main) return COPY.stale
  if (data?.errors?.save_as_owner) return COPY.demoHint
  if (data?.errors?.image) return COPY.invalidImage
  return COPY.error
}
