import type { BuyerAction, BuyerActionWrite } from '@entities/order'

export interface BuyerIntent {
  /** Подтверждённое действие. */
  action: BuyerAction
  /** Неизменное тело запроса. */
  values: BuyerActionWrite
}

const PREFIX = 'coffee:buyerIntent:'

export function readBuyerIntent(actorKey: string, id: string): BuyerIntent | null {
  try {
    const value = JSON.parse(
      sessionStorage.getItem(`${PREFIX}${actorKey}:${id}`) ?? 'null',
    ) as BuyerIntent | null
    if (
      !value ||
      !['cancel', 'request_cancellation'].includes(value.action) ||
      typeof value.values?.request_id !== 'string' ||
      typeof value.values.reason !== 'string' ||
      !['pending', 'paid', 'processing'].includes(value.values.expected_status)
    )
      return null
    return value
  } catch {
    return null
  }
}

export function saveBuyerIntent(
  actorKey: string,
  id: string,
  intent: BuyerIntent,
): void {
  sessionStorage.setItem(`${PREFIX}${actorKey}:${id}`, JSON.stringify(intent))
}

export function clearBuyerIntent(actorKey: string, id: string): void {
  sessionStorage.removeItem(`${PREFIX}${actorKey}:${id}`)
}

/** Убирает чужие незавершённые подтверждения при явном входе или выходе. */
export function clearBuyerIntents(): void {
  try {
    for (let index = sessionStorage.length - 1; index >= 0; index--) {
      const key = sessionStorage.key(index)
      if (
        key &&
        (key.startsWith(PREFIX) || key.startsWith('coffee:staffCancellationIntent:'))
      )
        sessionStorage.removeItem(key)
    }
  } catch {
    // Недоступное хранилище не должно мешать смене сессии.
  }
}
