import demoCoffee1 from './assets/demo-coffee-1.svg'
import demoCoffee2 from './assets/demo-coffee-2.svg'
import demoCoffee3 from './assets/demo-coffee-3.svg'
import demoMachine1 from './assets/demo-machine-1.svg'
import demoMachine2 from './assets/demo-machine-2.svg'

/**
 * Color token sample for the design-system page.
 * Values are a docs-only caption mirror of `docs/design/design-tokens.md`
 * (and `tokens.css`). Update together when the palette changes — not a second
 * runtime source of truth; chip fill always uses `var(--token)`.
 */
export interface ColorSwatch {
  /** CSS custom property name. */
  token: string
  /** Caption hex/value mirrored from design-tokens.md (display only). */
  value: string
  /** Short role description. */
  role: string
}

/**
 * Spacing token sample.
 */
export interface SpaceSample {
  /** CSS custom property name. */
  token: string
  /** Pixel value from the docs. */
  value: string
}

export const COLOR_SWATCHES: ColorSwatch[] = [
  { token: '--color-bg', value: '#F7F2EA', role: 'Фон страницы' },
  { token: '--color-surface', value: '#FFFDF9', role: 'Карточки, поля' },
  { token: '--color-border', value: '#E3D9C8', role: 'Рамки' },
  { token: '--color-primary', value: '#B0592A', role: 'Акцент' },
  { token: '--color-primary-hover', value: '#964A24', role: 'Hover primary' },
  { token: '--color-primary-on', value: '#FFF5EC', role: 'Текст на primary' },
  { token: '--color-secondary', value: '#6B7A4F', role: 'Второй акцент' },
  { token: '--color-neutral', value: '#3E362C', role: 'Тёмный нейтральный' },
  { token: '--color-text', value: '#2E2A22', role: 'Основной текст' },
  { token: '--color-text-secondary', value: '#5C5346', role: 'Вторичный текст' },
  { token: '--color-text-muted', value: '#8C8272', role: 'Вспомогательный' },
  { token: '--color-text-placeholder', value: '#A69C8B', role: 'Плейсхолдер' },
  { token: '--color-danger', value: '#B42318', role: 'Ошибка' },
  { token: '--color-success', value: '#3B6D11', role: 'Успех' },
  { token: '--color-badge-bg', value: '#EDE6DA', role: 'Фон бейджа' },
  { token: '--color-badge-text', value: '#5C5346', role: 'Текст бейджа' },
  {
    token: '--color-badge-success-bg',
    value: 'mix success 16%',
    role: 'Фон Badge success',
  },
  {
    token: '--color-badge-danger-bg',
    value: 'mix danger 14%',
    role: 'Фон Badge danger',
  },
]

export const SPACE_SAMPLES: SpaceSample[] = [
  { token: '--space-2xs', value: '4px' },
  { token: '--space-xs', value: '8px' },
  { token: '--space-sm', value: '12px' },
  { token: '--space-md', value: '16px' },
  { token: '--space-lg', value: '24px' },
  { token: '--space-xl', value: '32px' },
  { token: '--space-2xl', value: '48px' },
]

export const RADIUS_SAMPLES = [
  { token: '--radius-sm', value: '6px' },
  { token: '--radius-md', value: '8px' },
  { token: '--radius-lg', value: '12px' },
  { token: '--radius-xl', value: '16px' },
] as const

export const SELECT_DEMO_OPTIONS = [
  { value: 'name', label: 'По названию' },
  { value: 'price-asc', label: 'Сначала дешевле' },
  { value: 'price-desc', label: 'Сначала дороже' },
]

export const UI_KIT_NAV = [
  { href: '#colors', label: 'Colors' },
  { href: '#typography', label: 'Typography' },
  { href: '#spacing', label: 'Spacing' },
  { href: '#radius', label: 'Radius' },
  { href: '#shadow', label: 'Shadow' },
  { href: '#grid', label: 'Grid' },
  { href: '#components', label: 'Components' },
  { href: '#product-cards', label: 'Product cards' },
  { href: '#toast-empty', label: 'Toast / Empty' },
  { href: '#layout', label: 'Layout' },
] as const

/** Demo image set — локальные плейсхолдеры, витрина работает без сети. */
export const DEMO_COFFEE_IMAGES = [demoCoffee1, demoCoffee2, demoCoffee3]

export const DEMO_MACHINE_IMAGES = [demoMachine1, demoMachine2]
