import { guardRequest, http } from '@shared/api'
import type { ManageProductImage } from './manageCatalogApi'

export type ImageChange =
  | { type: 'upload'; file: File }
  | { type: 'change'; imageId: number; values: { order?: number; is_main?: true } }
  | { type: 'delete'; imageId: number }

/** Меняет только фотографии; поля и происхождение товара сюда не отправляются. */
export async function changeManageImage(
  productId: string,
  change: ImageChange,
  assertActor: () => void,
) {
  const path = `/api/manage/products/${encodeURIComponent(productId)}/images/`
  const config = guardRequest(assertActor)
  assertActor()
  if (change.type === 'upload') {
    const body = new FormData()
    body.append('image', change.file)
    await http.post<ManageProductImage>(path, body, config)
  } else if (change.type === 'change') {
    await http.patch<ManageProductImage>(
      `${path}${change.imageId}/`,
      change.values,
      config,
    )
  } else {
    await http.delete(`${path}${change.imageId}/`, config)
  }
  assertActor()
}
