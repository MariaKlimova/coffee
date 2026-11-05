/** Гостевое право хранится отдельно от корзины и временного возврата с оплаты. */
const PROOF_PREFIX = 'coffee:guestOrder:'
const CHECKOUT_INTENT_KEY = 'coffee:guestCheckoutIntent'
const listeners = new Set<() => void>()
const RETAINED_PROOF_VERSIONS = 3

export interface GuestCheckoutIntent {
  /** UUID исходного оформления. */
  checkoutRequestId: string
  /** Неизменное подтверждение исходной корзины. */
  originalCartToken: string
  /** Исходные проверенные данные для явного повтора оформления; у старых записей отсутствуют. */
  createBody?: GuestCheckoutBody
}

export interface GuestCheckoutBody {
  /** Сохранённый адрес доставки. */
  delivery_address: string
  /** Сохранённый email гостя. */
  guest_email: string
  /** Сохранённый телефон гостя. */
  guest_phone: string
}

export interface GuestOrderProof extends Omit<GuestCheckoutIntent, 'createBody'> {
  /** UUID заказа. */
  orderId: string
  /** Приватный секрет действия. */
  token: string
  /** Серверная монотонная версия секрета. */
  version: number
}

function notify() {
  listeners.forEach((listener) => listener())
}

function changed(event: StorageEvent) {
  if (event.key === null) {
    notify()
  } else if (event.key.startsWith(PROOF_PREFIX)) {
    const suffix = event.key.slice(PROOF_PREFIX.length)
    const separator = suffix.lastIndexOf(':v')
    if (separator < 0) return
    const version = Number(suffix.slice(separator + 2))
    if (Number.isSafeInteger(version) && version > 0) notify()
  }
}

/** Одна подписка на storage для всех карточек; секреты остаются вне кэша запросов. */
export function subscribeGuestOrderProof(listener: () => void) {
  if (!listeners.size) window.addEventListener('storage', changed)
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
    if (!listeners.size) window.removeEventListener('storage', changed)
  }
}

function proofEntries(orderId: string): { key: string; proof: GuestOrderProof }[] {
  const prefix = `${PROOF_PREFIX}${orderId}:v`
  const entries: { key: string; proof: GuestOrderProof }[] = []
  for (let index = 0; index < localStorage.length; index++) {
    const key = localStorage.key(index)
    if (!key?.startsWith(prefix)) continue
    try {
      const value: unknown = JSON.parse(localStorage.getItem(key) ?? 'null')
      if (!value || typeof value !== 'object') continue
      const proof = value as Partial<GuestOrderProof>
      if (
        proof.orderId !== orderId ||
        typeof proof.token !== 'string' ||
        !proof.token ||
        !Number.isSafeInteger(proof.version) ||
        (proof.version ?? 0) < 1 ||
        key !== `${prefix}${proof.version}` ||
        typeof proof.checkoutRequestId !== 'string' ||
        !proof.checkoutRequestId ||
        typeof proof.originalCartToken !== 'string' ||
        !proof.originalCartToken
      )
        continue
      entries.push({ key, proof: proof as GuestOrderProof })
    } catch {
      /* Повреждённая запись не становится подтверждением доступа. */
    }
  }
  return entries.sort((left, right) => right.proof.version - left.proof.version)
}

/** Выбирает наибольшую сохранённую версию; поздняя запись другой вкладки её не затирает. */
export function readGuestOrderProof(orderId: string): GuestOrderProof | null {
  try {
    const proof = proofEntries(orderId)[0]?.proof ?? null
    return proof
  } catch {
    return null
  }
}

/** Каждая версия имеет отдельный ключ: проверка и запись не требуют межвкладочной блокировки. */
export function writeGuestOrderProof(proof: GuestOrderProof): GuestOrderProof {
  const current = readGuestOrderProof(proof.orderId)
  if (current && current.version >= proof.version) return current
  localStorage.setItem(
    `${PROOF_PREFIX}${proof.orderId}:v${proof.version}`,
    JSON.stringify({
      orderId: proof.orderId,
      token: proof.token,
      version: proof.version,
      checkoutRequestId: proof.checkoutRequestId,
      originalCartToken: proof.originalCartToken,
    }),
  )
  const stored = readGuestOrderProof(proof.orderId)
  if (!stored || stored.version < proof.version)
    throw new Error('Не удалось сохранить доступ')
  // Удаляются только известные старые версии; параллельная новая версия остаётся.
  for (const entry of proofEntries(proof.orderId).slice(RETAINED_PROOF_VERSIONS))
    localStorage.removeItem(entry.key)
  notify()
  return stored
}

/** Версия безопасна для подписки; секрет не попадает в React queryKey. */
export function guestOrderProofVersion(orderId: string): number {
  return readGuestOrderProof(orderId)?.version ?? 0
}

/** Сохраняет исходное доказательство до отправки оформления. Ошибка не скрывается. */
export function writeGuestCheckoutIntent(intent: GuestCheckoutIntent): void {
  localStorage.setItem(CHECKOUT_INTENT_KEY, JSON.stringify(intent))
  const saved = readGuestCheckoutIntent()
  if (saved?.checkoutRequestId !== intent.checkoutRequestId)
    throw new Error('Не удалось сохранить оформление')
}

export function readGuestCheckoutIntent(): GuestCheckoutIntent | null {
  try {
    const value: unknown = JSON.parse(
      localStorage.getItem(CHECKOUT_INTENT_KEY) ?? 'null',
    )
    if (!value || typeof value !== 'object') return null
    const intent = value as Partial<GuestCheckoutIntent>
    if (
      typeof intent.checkoutRequestId !== 'string' ||
      !intent.checkoutRequestId ||
      typeof intent.originalCartToken !== 'string' ||
      !intent.originalCartToken
    )
      return null
    const body = intent.createBody
    const validBody =
      body &&
      typeof body === 'object' &&
      typeof body.delivery_address === 'string' &&
      Boolean(body.delivery_address.trim()) &&
      typeof body.guest_email === 'string' &&
      Boolean(body.guest_email.trim()) &&
      typeof body.guest_phone === 'string' &&
      Boolean(body.guest_phone.trim())
    return {
      checkoutRequestId: intent.checkoutRequestId,
      originalCartToken: intent.originalCartToken,
      ...(validBody
        ? {
            createBody: {
              delivery_address: body.delivery_address,
              guest_email: body.guest_email,
              guest_phone: body.guest_phone,
            },
          }
        : {}),
    }
  } catch {
    return null
  }
}

export function clearGuestCheckoutIntent(checkoutRequestId: string): void {
  if (readGuestCheckoutIntent()?.checkoutRequestId === checkoutRequestId) {
    localStorage.removeItem(CHECKOUT_INTENT_KEY)
  }
}
