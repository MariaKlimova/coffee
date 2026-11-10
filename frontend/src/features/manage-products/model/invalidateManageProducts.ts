import type { QueryClient, QueryKey } from '@tanstack/react-query'

/** Обновляет каталог и покупательские данные только для исходной staff-сессии. */
export async function invalidateManageProducts(
  client: QueryClient,
  prefix: QueryKey,
  assertActor: () => void,
) {
  assertActor()
  await Promise.all([
    client.invalidateQueries({ queryKey: prefix }),
    ...['products', 'cart', 'favorites'].map((name) =>
      client.invalidateQueries({ queryKey: [name] }),
    ),
  ])
  assertActor()
}
