/** Якорь «Мои заказы» в шапке (списка заказов пока нет). */
export const ORDERS_HREF = '/#orders'

/**
 * Подставляет id в шаблон «Номер заказа: {id}».
 */
export function formatOrderNumberLabel(
  template: string,
  orderId: string,
): string {
  return template.replace('{id}', orderId)
}
