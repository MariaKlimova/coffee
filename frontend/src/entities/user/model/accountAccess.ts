import type { AuthStoreState } from './authStore.typings'

/** Единая политика интерфейса: сотрудник управляет, покупатель и гость покупают. */
export function selectAccountMode(
  state: Pick<AuthStoreState, 'status' | 'user'>,
): 'owner' | 'customer' | 'pending' {
  if (state.status === 'idle' || state.status === 'restoring') return 'pending'
  if (state.status === 'authenticated' && state.user?.is_staff === true) return 'owner'
  return 'customer'
}

/** Покупательские действия доступны только после определения роли. */
export const selectCanShop = (
  state: Pick<AuthStoreState, 'status' | 'user'>,
): boolean => selectAccountMode(state) === 'customer'

/** Вход в управление показывается только сотруднику с подтверждённой сессией. */
export const selectCanManage = (
  state: Pick<AuthStoreState, 'status' | 'user'>,
): boolean => selectAccountMode(state) === 'owner'

/** Личное избранное загружается только для авторизованного покупателя. */
export const selectCanUseFavorites = (
  state: Pick<AuthStoreState, 'status' | 'user'>,
): boolean => state.status === 'authenticated' && selectCanShop(state)

/** Ответ старого покупателя не должен изменять данные новой сессии или владельца. */
export function isSameCustomerSession(
  previous: AuthStoreState,
  current: AuthStoreState,
): boolean {
  return (
    selectCanShop(current) &&
    current.status === previous.status &&
    current.user?.id === previous.user?.id &&
    current.sessionGeneration === previous.sessionGeneration
  )
}
