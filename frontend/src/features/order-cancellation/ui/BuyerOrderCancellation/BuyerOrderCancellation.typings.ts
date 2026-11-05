import type { useBuyerOrder } from '../../model/useBuyerOrder'

export interface BuyerOrderActionsProps {
  /** Запрос приватного состояния текущего покупателя. */
  buyer: ReturnType<typeof useBuyerOrder>
  /** UUID заказа. */
  id: string
  /** Компактное действие в строке заказа с раскрытием подробностей ниже. */
  inline?: boolean
}

export interface BuyerOrderCancellationProps {
  /** UUID заказа для строки списка. */
  id: string
  /** Размещает действие рядом со ссылкой на заказ. */
  inline?: boolean
}
