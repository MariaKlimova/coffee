import { beforeEach, describe, expect, it, vi } from 'vitest'

import { clearPendingOrderId, writePendingOrderId } from '@features/checkout'
import {
  guestOrderProofVersion,
  readGuestOrderProof,
  subscribeGuestOrderProof,
  writeGuestOrderProof,
} from './guestOrderStorage'

const proof = {
  orderId: 'synthetic-order',
  token: 'synthetic-proof-v1',
  version: 1,
  checkoutRequestId: 'synthetic-intent',
  originalCartToken: 'synthetic-original-cart',
}

beforeEach(() => localStorage.clear())

describe('Гостевое подтверждение заказа', () => {
  it('A читает пустое → B сохраняет v2 и закрывается → A сохраняет v1: durable чтение после reload выбирает v2', async () => {
    const newer = { ...proof, version: 2, token: 'synthetic-proof-v2' }
    const originalSet = localStorage.setItem.bind(localStorage)
    const spy = vi.spyOn(localStorage, 'setItem').mockImplementation((key, value) => {
      if (key === `coffee:guestOrder:${proof.orderId}:v1`) {
        originalSet(`coffee:guestOrder:${proof.orderId}:v2`, JSON.stringify(newer))
      }
      originalSet(key, value)
    })
    try {
      expect(writeGuestOrderProof(proof)).toEqual(newer)
    } finally {
      spy.mockRestore()
    }
    // Новая вкладка не видит память прежних вкладок и не получает storage-события.
    vi.resetModules()
    const reloaded = await import('./guestOrderStorage')
    expect(reloaded.readGuestOrderProof(proof.orderId)).toEqual(newer)
    expect(localStorage.getItem(`coffee:guestOrder:${proof.orderId}:v2`)).not.toBeNull()
  })

  it('ограничивает старые версии и сохраняет актуальный доступ', () => {
    for (let version = 1; version <= 12; version++)
      writeGuestOrderProof({ ...proof, version, token: `synthetic-proof-v${version}` })
    expect(localStorage.length).toBe(3)
    expect(readGuestOrderProof(proof.orderId)?.version).toBe(12)
  })
  it('остаётся после очистки возврата с оплаты и не откатывается поздним ответом', () => {
    writeGuestOrderProof(proof)
    writePendingOrderId(proof.orderId)
    clearPendingOrderId()
    expect(readGuestOrderProof(proof.orderId)).toEqual(proof)
    writeGuestOrderProof({ ...proof, version: 3, token: 'synthetic-proof-v3' })
    writeGuestOrderProof({ ...proof, version: 2, token: 'synthetic-proof-v2' })
    expect(readGuestOrderProof(proof.orderId)?.token).toBe('synthetic-proof-v3')
  })

  it('принимает новую версию другой вкладки и игнорирует запоздавшее storage-событие', () => {
    writeGuestOrderProof(proof)
    const stop = subscribeGuestOrderProof(() => undefined)
    try {
      const newer = { ...proof, token: 'synthetic-proof-v4', version: 4 }
      localStorage.setItem(
        `coffee:guestOrder:${proof.orderId}:v${newer.version}`,
        JSON.stringify(newer),
      )
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: `coffee:guestOrder:${proof.orderId}:v${newer.version}`,
          newValue: JSON.stringify(newer),
        }),
      )
      expect(guestOrderProofVersion(proof.orderId)).toBe(4)
      localStorage.setItem(
        `coffee:guestOrder:${proof.orderId}:v${proof.version}`,
        JSON.stringify(proof),
      )
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: `coffee:guestOrder:${proof.orderId}:v${proof.version}`,
          newValue: JSON.stringify(proof),
        }),
      )
      expect(readGuestOrderProof(proof.orderId)).toEqual(newer)
      localStorage.clear()
      window.dispatchEvent(new StorageEvent('storage', { key: null }))
      expect(readGuestOrderProof(proof.orderId)).toBeNull()
    } finally {
      stop()
    }
  })
})
