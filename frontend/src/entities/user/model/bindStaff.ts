import { CanceledError } from 'axios'

import { selectCanManage } from './accountAccess'
import { useAuthStore } from './authStore'

/** Привязывает проверку к исходной staff-сессии до любого ожидания или транспорта. */
export function bindStaff() {
  const actor = useAuthStore.getState()
  return () => {
    const current = useAuthStore.getState()
    if (
      !selectCanManage(actor) ||
      !selectCanManage(current) ||
      actor.sessionGeneration !== current.sessionGeneration ||
      actor.user?.id !== current.user?.id
    ) {
      throw new CanceledError('Сессия управления завершена')
    }
  }
}
