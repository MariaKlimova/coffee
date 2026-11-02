import type { Paginated, Product, ProductCategorySlug } from '@entities/product'
import { guardRequest, http } from '@shared/api'

export interface ManageProduct extends Product {
  /** Физическое количество товара. */
  stock_quantity: number
  /** Количество, занятое заказами. */
  reserved_quantity: number
  /** Количество, доступное к заказу. */
  available_quantity: number
  /** Публикация на витрине. */
  is_published: boolean
  /** Происхождение товара, назначенное сервером. */
  origin: 'demo' | 'owner'
  /** Причина скрытия с витрины. */
  hidden_reason: 'unpublished' | 'demo_disabled' | null
}

export interface ManageFilters {
  /** Поиск по названию. */
  search: string
  /** Категория или все категории. */
  category: ProductCategorySlug | ''
  /** Состояние публикации или все товары. */
  is_published: '' | 'true' | 'false'
  /** Номер страницы. */
  page: number
}

export interface CatalogState {
  /** Показываются ли демо-товары на витрине. */
  demo_enabled: boolean
  /** Сохранённое время перехода на свой каталог. */
  switched_at: string | null
  /** Общее количество демо-товаров. */
  demo_product_count: number
  /** Общее количество своих товаров. */
  owner_product_count: number
  /** Количество опубликованных своих товаров. */
  published_owner_product_count: number
}

export interface ProductChange {
  /** Изменяемый товар. */
  id: string
  /** Новое физическое количество. */
  stock_quantity?: number
  /** Явное сохранение демо-товара как своего. */
  save_as_owner?: boolean
  /** Новое состояние публикации. */
  is_published?: boolean
}

export const MANAGE_PAGE_SIZE = 20

export async function fetchManageProducts(
  filters: ManageFilters,
  signal: AbortSignal,
  assertActor: () => void,
): Promise<Paginated<ManageProduct>> {
  const params = Object.fromEntries(
    Object.entries({ ...filters, page_size: MANAGE_PAGE_SIZE }).filter(
      ([, value]) => value !== '',
    ),
  )
  const { data } = await http.get<Paginated<ManageProduct>>('/api/manage/products/', {
    ...guardRequest(assertActor),
    params,
    signal,
  })
  assertActor()
  return data
}

export async function fetchCatalogState(signal: AbortSignal, assertActor: () => void) {
  const { data } = await http.get<CatalogState>('/api/manage/catalog/', {
    ...guardRequest(assertActor),
    signal,
  })
  assertActor()
  return data
}

export async function changeManageProduct(
  change: ProductChange,
  assertActor: () => void,
) {
  const { id, ...body } = change
  const { data } = await http.patch<ManageProduct>(
    `/api/manage/products/${id}/`,
    body,
    guardRequest(assertActor),
  )
  assertActor()
  return data
}

export async function disableDemo(assertActor: () => void) {
  const { data } = await http.post<CatalogState>(
    '/api/manage/catalog/disable-demo/',
    {},
    guardRequest(assertActor),
  )
  assertActor()
  return data
}

/** Снимает товар с витрины без изменения происхождения, фотографий и количества. */
export async function hideManageProduct(id: string, assertActor: () => void) {
  await http.delete(`/api/manage/products/${id}/`, guardRequest(assertActor))
  assertActor()
}
