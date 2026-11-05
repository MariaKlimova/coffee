import type { useBuyerOrder } from '../../model/useBuyerOrder'

export interface BuyerOrderActionsProps {
  /** Запрос приватного состояния текущего покупателя. */
  buyer: ReturnType<typeof useBuyerOrder>
  /** UUID заказа. */
  id: string
}

export interface BuyerOrderCancellationProps {
  /** UUID заказа для строки списка. */
  id: string
}
