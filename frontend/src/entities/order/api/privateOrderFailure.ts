import { AxiosError, AxiosHeaders, CanceledError, isAxiosError, isCancel } from 'axios'

/** Ошибка приватного транспорта не переносит заголовки доступа в QueryClient. */
export function privateOrderFailure(failure: unknown): Error {
  if (isCancel(failure)) return new CanceledError('Запрос заказа отменён')
  const safe = new AxiosError('Не удалось выполнить действие с заказом')
  if (isAxiosError(failure) && failure.response) {
    const code: unknown = failure.response.data?.code
    safe.response = {
      status: failure.response.status,
      statusText: '',
      headers: {},
      config: { headers: new AxiosHeaders() },
      data: { code: typeof code === 'string' ? code : undefined },
    }
    safe.status = failure.response.status
  }
  return safe
}
