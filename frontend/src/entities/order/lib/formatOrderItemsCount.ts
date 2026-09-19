import { ORDER_DETAIL_COPY } from '@shared/lib/copy'

/**
 * Русская плюрализация «N позиция/позиции/позиций».
 */
export function formatOrderItemsCount(count: number): string {
  const mod10 = count % 10
  const mod100 = count % 100

  let template: string = ORDER_DETAIL_COPY.itemsCountMany
  if (mod10 === 1 && mod100 !== 11) {
    template = ORDER_DETAIL_COPY.itemsCountOne
  } else if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    template = ORDER_DETAIL_COPY.itemsCountFew
  }

  return template.replace('{count}', String(count))
}
