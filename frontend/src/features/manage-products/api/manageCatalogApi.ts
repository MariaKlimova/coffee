import type {
  Paginated,
  Product,
  ProductCategorySlug,
  ProductImageDto,
} from '@entities/product'
import { guardRequest, http } from '@shared/api'

export interface ManageProductImage extends ProductImageDto {
  /** Серверный идентификатор фотографии для изменения и удаления. */
  id: number
}

export interface ManageProduct extends Product {
  /** Фотографии с идентификаторами, доступными сотруднику. */
  images: ManageProductImage[]
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

/** Разрешённые поля формы; фотографии и серверные счётчики сюда не входят. */
export interface ProductFormWrite {
  /** Название товара. */
  name: string
  /** Категория товара. */
  category: ProductCategorySlug
  /** Краткое описание. */
  short_description: string
  /** Полное описание. */
  description: string
  /** Текущая цена в рублях. */
  price: string
  /** Предыдущая цена либо отсутствие скидки. */
  old_price: string | null
  /** Характеристики выбранной категории. */
  attributes: Record<string, string | number>
  /** Физический остаток. */
  stock_quantity: number
  /** Публикация на витрине. */
  is_published: boolean
  /** Явное согласие сохранить демо-товар как свой. */
  save_as_owner?: boolean
}

export async function fetchManageProduct(
  id: string,
  signal: AbortSignal,
  assertActor: () => void,
) {
  const { data } = await http.get<ManageProduct>(
    `/api/manage/products/${encodeURIComponent(id)}/`,
    {
      ...guardRequest(assertActor),
      signal,
    },
  )
  assertActor()
  return data
}

export async function saveManageProduct(
  values: ProductFormWrite,
  id: string | undefined,
  assertActor: () => void,
) {
  const config = guardRequest(assertActor)
  const response = id
    ? await http.patch<ManageProduct>(
        `/api/manage/products/${encodeURIComponent(id)}/`,
        values,
        config,
      )
    : await http.post<ManageProduct>('/api/manage/products/', values, config)
  assertActor()
  return response.data
}
