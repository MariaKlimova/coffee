/**
 * Подставляет id в шаблон «Номер заказа: {id}».
 */
export function formatOrderNumberLabel(template: string, orderId: string): string {
  return template.replace('{id}', orderId)
}
