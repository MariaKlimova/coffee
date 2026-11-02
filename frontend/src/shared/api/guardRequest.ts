import axios, { type AxiosRequestConfig } from 'axios'

import { http } from './http'

/** Проверяет актуальность инициатора непосредственно перед отправкой транспорта. */
export function guardRequest(assertAllowed?: () => void): AxiosRequestConfig {
  if (!assertAllowed) return {}
  const adapter = axios.getAdapter(http.defaults.adapter)
  return {
    adapter: (config) => {
      assertAllowed()
      return adapter(config)
    },
  }
}
