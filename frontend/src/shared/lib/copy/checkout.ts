import { ORDER_CREATED } from './phrases'

/**
 * Пользовательские строки страницы оформления заказа (product-voice, glossary).
 */
export const CHECKOUT_COPY = {
  title: 'Оформление заказа',
  summaryLabel: 'Твой заказ',
  total: 'Итого',
  addressLabel: 'Адрес доставки',
  emailLabel: 'Почта',
  phoneLabel: 'Телефон',
  pay: 'Оплатить',
  paying: 'Оформляем оплату',
  orderCreated: ORDER_CREATED,
  startingPayment: 'Переходим к оплате — это может занять несколько секунд',
  savedOrderTitle: 'У тебя есть неоплаченный заказ',
  savedOrderDescription:
    'Вернись к его оплате или оформи новый заказ из текущей корзины',
  resumePayment: 'Продолжить оплату',
  newOrder: 'Оформить новый заказ',
  addressRequired: 'Укажи адрес доставки',
  emailRequired: 'Укажи почту',
  emailInvalid: 'Проверь адрес почты',
  phoneRequired: 'Укажи телефон',
  emptyCartToast: 'В корзине пока пусто — сначала добавь товары',
  noAvailableItems:
    'В корзине нет товаров в наличии. Вернись в корзину и обнови состав',
  goToCart: 'В корзину',
  formErrorGeneric: 'Не удалось оформить заказ. Попробуй ещё раз',
  paymentError: 'Не удалось перейти к оплате. Попробуй ещё раз',
  unavailablePrefix: 'Сейчас нельзя оформить',
  unavailableSuffix: 'Убери эти позиции из корзины или загляни позже',
  quantity: 'шт.',
} as const
