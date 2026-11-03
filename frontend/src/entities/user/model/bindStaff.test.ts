import { isCancel } from 'axios'
import { afterEach, describe, expect, it } from 'vitest'

import { bindStaff, useAuthStore } from '../index'

function login(id = 'staff-a', isStaff = true) {
  useAuthStore.getState().setSession({
    accessToken: 'synthetic-access',
    refreshToken: 'synthetic-refresh',
    user: { id, email: `${id}@example.invalid`, is_staff: isStaff },
  })
}

function cancellation(assert: () => void) {
  let failure: unknown
  try {
    assert()
  } catch (error) {
    failure = error
  }
  expect(isCancel(failure)).toBe(true)
}

afterEach(() => useAuthStore.getState().clearSession())

describe('Привязка отложенных действий сотрудника', () => {
  it('обновление access-токена той же сессии не отменяет действие', () => {
    login()
    const assert = bindStaff()
    useAuthStore.setState({ accessToken: 'synthetic-refreshed-access' })
    expect(assert).not.toThrow()
  })
  it('новый вход того же сотрудника отменяет старое действие даже с теми же токенами', () => {
    login()
    const assert = bindStaff()
    login()
    cancellation(assert)
    expect(bindStaff()).not.toThrow()
  })
  it('действие, начатое гостем, не получает права последующего входа сотрудника', () => {
    useAuthStore.getState().clearSession()
    const assert = bindStaff()
    login()
    cancellation(assert)
  })
  it('утрата роли при неизменных аккаунте и поколении отменяет действие', () => {
    login()
    const assert = bindStaff()
    const user = useAuthStore.getState().user!
    useAuthStore.setState({ user: { ...user, is_staff: false } })
    cancellation(assert)
  })
  it('смена личности без ротации поколения всё равно отменяет действие', () => {
    login()
    const assert = bindStaff()
    const user = useAuthStore.getState().user!
    useAuthStore.setState({ user: { ...user, id: 'staff-b' } })
    cancellation(assert)
  })
  it('восстановление и выход не сохраняют право отложенного действия', () => {
    login()
    const assert = bindStaff()
    useAuthStore.setState({ status: 'restoring' })
    cancellation(assert)
    useAuthStore.getState().clearSession()
    cancellation(assert)
  })
})
