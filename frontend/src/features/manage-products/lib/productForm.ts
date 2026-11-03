import axios from 'axios'
import type { ProductCategorySlug } from '@entities/product'
import { MANAGE_COPY, PRODUCT_FORM_COPY as COPY } from '@shared/lib/copy'
import type { ManageProduct, ProductFormWrite } from '../api/manageCatalogApi'

export const ATTRIBUTE_FIELDS = {
  coffee: ['country', 'intensity', 'bitterness', 'acidity', 'roast', 'density'],
  machines: [
    'dimensions',
    'pressure_bar',
    'power_w',
    'capsule_format',
    'manufacturer_country',
  ],
} as const
export type AttributeField = (typeof ATTRIBUTE_FIELDS)[ProductCategorySlug][number]
export type FormErrors = Partial<
  Record<
    keyof FormValues | `attributes.${AttributeField}` | 'save_as_owner' | 'attributes',
    string
  >
>
export interface FormValues {
  /** Название. */
  name: string
  /** Категория. */
  category: ProductCategorySlug
  /** Краткое описание. */
  short_description: string
  /** Полное описание. */
  description: string
  /** Цена в вводимом формате. */
  price: string
  /** Цена до скидки. */
  old_price: string
  /** Физический остаток. */
  stock_quantity: string
  /** Публикация. */
  is_published: boolean
  /** Введённые характеристики. */
  attributes: Partial<Record<AttributeField, string>>
}
export function initialForm(product?: ManageProduct): FormValues {
  return {
    name: product?.name ?? '',
    category: product?.category ?? 'coffee',
    short_description: product?.short_description ?? '',
    description: product?.description ?? '',
    price: product?.price ?? '',
    old_price: product?.old_price ?? '',
    stock_quantity: String(product?.stock_quantity ?? 0),
    is_published: product?.is_published ?? true,
    attributes: Object.fromEntries(
      Object.entries(product?.attributes ?? {}).map(([key, value]) => [
        key,
        value == null ? '' : String(value),
      ]),
    ),
  }
}
export function attributeMax(field: AttributeField): number | undefined {
  if (field === 'intensity') return 13
  if (['bitterness', 'acidity', 'roast', 'density'].includes(field)) return 5
  return undefined
}
export function isNumericAttribute(field: AttributeField) {
  return (
    attributeMax(field) !== undefined || field === 'pressure_bar' || field === 'power_w'
  )
}
const moneyPattern = /^\d{1,8}([.,]\d{1,2})?$/
export function validateForm(
  values: FormValues,
  demo: boolean,
  consent: boolean,
): FormErrors {
  const errors: FormErrors = {}
  if (!values.name.trim()) errors.name = COPY.required
  else if (values.name.trim().length > 255) errors.name = COPY.nameLength
  if (!values.short_description.trim()) errors.short_description = COPY.required
  else if (values.short_description.trim().length > 300)
    errors.short_description = COPY.shortLength
  if (!moneyPattern.test(values.price.trim())) errors.price = COPY.moneyInvalid
  if (values.old_price.trim()) {
    if (!moneyPattern.test(values.old_price.trim()))
      errors.old_price = COPY.moneyInvalid
    else if (
      Number(values.old_price.replace(',', '.')) <=
      Number(values.price.replace(',', '.'))
    )
      errors.old_price = COPY.oldPriceInvalid
  }
  if (
    !/^\d+$/.test(values.stock_quantity) ||
    Number(values.stock_quantity) > 2147483647
  )
    errors.stock_quantity = MANAGE_COPY.quantityInvalid
  for (const field of ATTRIBUTE_FIELDS[values.category]) {
    const value = values.attributes[field]?.trim() ?? ''
    if (!value || !isNumericAttribute(field)) continue
    const max = attributeMax(field)
    if (
      !/^\d+$/.test(value) ||
      !Number.isSafeInteger(Number(value)) ||
      (max !== undefined && Number(value) > max)
    ) {
      errors[`attributes.${field}`] =
        max === undefined ? COPY.integerInvalid : COPY.rangeInvalid(max)
    }
  }
  if (demo && !consent) errors.save_as_owner = MANAGE_COPY.demoConsentRequired
  return errors
}
export function formPayload(values: FormValues, demo: boolean): ProductFormWrite {
  const attributes: Record<string, string | number> = {}
  for (const field of ATTRIBUTE_FIELDS[values.category]) {
    const value = values.attributes[field]?.trim() ?? ''
    if (value) attributes[field] = isNumericAttribute(field) ? Number(value) : value
  }
  return {
    name: values.name.trim(),
    category: values.category,
    short_description: values.short_description.trim(),
    description: values.description,
    price: values.price.trim().replace(',', '.'),
    old_price: values.old_price.trim().replace(',', '.') || null,
    stock_quantity: Number(values.stock_quantity),
    is_published: values.is_published,
    attributes,
    ...(demo ? { save_as_owner: true } : {}),
  }
}
/** Переводит структурированные ошибки сервера, не показывая внутренние сообщения. */
export function mapFormError(error: unknown): FormErrors {
  if (!axios.isAxiosError(error) || error.response?.status !== 400) return {}
  const errors: unknown = error.response.data?.errors
  if (!errors || typeof errors !== 'object') return {}
  const result: FormErrors = {}
  for (const [key, value] of Object.entries(errors)) {
    if (
      key === 'attributes' &&
      value &&
      typeof value === 'object' &&
      !Array.isArray(value)
    ) {
      for (const field of Object.keys(value)) {
        if (
          [...ATTRIBUTE_FIELDS.coffee, ...ATTRIBUTE_FIELDS.machines].some(
            (known) => known === field,
          )
        )
          result[`attributes.${field as AttributeField}`] = COPY.fieldInvalid
      }
    } else if (key === 'attributes') result.attributes = COPY.attributesInvalid
    else if (
      key.startsWith('attributes.') &&
      [...ATTRIBUTE_FIELDS.coffee, ...ATTRIBUTE_FIELDS.machines].some(
        (known) => `attributes.${known}` === key,
      )
    )
      result[key as keyof FormErrors] = COPY.fieldInvalid
    else if (key === 'stock_quantity')
      result.stock_quantity = MANAGE_COPY.quantityConflict
    else if (key === 'save_as_owner')
      result.save_as_owner = MANAGE_COPY.demoConsentRequired
    else if (
      [
        'name',
        'category',
        'short_description',
        'description',
        'price',
        'old_price',
        'is_published',
      ].includes(key)
    )
      result[key as keyof FormErrors] = COPY.fieldInvalid
  }
  return result
}
