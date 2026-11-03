import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { CatalogFilters } from './CatalogFilters'

// jsdom не реализует штатное открытие модального dialog; фокус и Escape проверяются в Chrome.
const showModal = Object.getOwnPropertyDescriptor(
  HTMLDialogElement.prototype,
  'showModal',
)
const close = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'close')

beforeEach(() => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  )
  Object.defineProperties(HTMLDialogElement.prototype, {
    showModal: {
      configurable: true,
      value(this: HTMLDialogElement) {
        this.setAttribute('open', '')
      },
    },
    close: {
      configurable: true,
      value(this: HTMLDialogElement) {
        this.removeAttribute('open')
        fireEvent(this, new Event('close'))
      },
    },
  })
})

afterEach(() => {
  cleanup()
  if (showModal)
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', showModal)
  else Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal')
  if (close) Object.defineProperty(HTMLDialogElement.prototype, 'close', close)
  else Reflect.deleteProperty(HTMLDialogElement.prototype, 'close')
  vi.unstubAllGlobals()
})

describe('CatalogFilters mobile', () => {
  it('keeps edits as drafts, discards them on close, and counts only applied filters', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <CatalogFilters
        priceMin="100"
        inStockOnly
        ordering="-created_at"
        onChange={onChange}
      />,
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    const trigger = screen.getByRole('button', { name: 'Фильтры (2)' })
    await user.click(trigger)
    const dialog = screen.getByRole('dialog', { name: 'Фильтры' })
    await user.clear(within(dialog).getByLabelText('Цена от'))
    await user.type(within(dialog).getByLabelText('Цена от'), '900')
    await user.click(within(dialog).getByLabelText('Только в наличии'))
    expect(onChange).not.toHaveBeenCalled()
    expect(trigger).toHaveTextContent('Фильтры (2)')
    await user.click(within(dialog).getByRole('button', { name: 'Закрыть' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await user.click(trigger)
    expect(within(screen.getByRole('dialog')).getByLabelText('Цена от')).toHaveValue(
      '100',
    )
    expect(
      within(screen.getByRole('dialog')).getByLabelText('Только в наличии'),
    ).toBeChecked()
  })

  it('applies price range and availability once without intermediate API changes', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <CatalogFilters inStockOnly={false} ordering="-created_at" onChange={onChange} />,
    )
    await user.click(screen.getByRole('button', { name: 'Фильтры' }))
    const dialog = screen.getByRole('dialog')
    await user.type(within(dialog).getByLabelText('Цена от'), '100')
    await user.type(within(dialog).getByLabelText('Цена до'), '500')
    await user.click(within(dialog).getByLabelText('Только в наличии'))
    expect(onChange).not.toHaveBeenCalled()
    await user.click(within(dialog).getByRole('button', { name: 'Показать товары' }))
    expect(onChange).toHaveBeenCalledExactlyOnceWith({
      priceMin: '100',
      priceMax: '500',
      inStockOnly: true,
    })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('resets the draft until applied and changes sorting independently', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <CatalogFilters
        priceMin="100"
        priceMax="500"
        inStockOnly
        ordering="price"
        onChange={onChange}
      />,
    )
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Сортировка' }),
      '-price',
    )
    expect(onChange).toHaveBeenCalledExactlyOnceWith({ ordering: '-price' })
    onChange.mockClear()
    await user.click(screen.getByRole('button', { name: 'Фильтры (3)' }))
    const dialog = screen.getByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Сбросить фильтры' }))
    expect(within(dialog).getByLabelText('Цена от')).toHaveValue('')
    expect(within(dialog).getByLabelText('Цена до')).toHaveValue('')
    expect(within(dialog).getByLabelText('Только в наличии')).not.toBeChecked()
    expect(onChange).not.toHaveBeenCalled()
    await user.click(within(dialog).getByRole('button', { name: 'Показать товары' }))
    expect(onChange).toHaveBeenCalledExactlyOnceWith({
      priceMin: undefined,
      priceMax: undefined,
      inStockOnly: false,
    })
  })
})
