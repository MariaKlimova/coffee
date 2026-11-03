import { selectCanManage, useAuthStore } from '@entities/user'

/** Захватывает инициатора до любого ожидания и проверяет его также на транспортной границе. */
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
      throw new Error('Сессия управления завершена')
    }
  }
}
