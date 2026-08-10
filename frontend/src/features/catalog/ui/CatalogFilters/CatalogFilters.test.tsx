import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { CatalogFilters } from './CatalogFilters'

describe('CatalogFilters', () => {
  it('commits price filters on blur and Enter', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()

    render(
      <CatalogFilters inStockOnly={false} ordering="-created_at" onChange={onChange} />,
    )

    const from = screen.getByLabelText('Цена от')
    await user.type(from, '100')
    await user.tab()
    expect(onChange).toHaveBeenCalledWith({ priceMin: '100' })

    onChange.mockClear()
    const to = screen.getByLabelText('Цена до')
    await user.type(to, '500')
    await user.keyboard('{Enter}')
    expect(onChange).toHaveBeenCalledWith({ priceMax: '500' })
  })

  it('toggles in-stock filter and sorting', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()

    render(
      <CatalogFilters inStockOnly={false} ordering="-created_at" onChange={onChange} />,
    )

    await user.click(screen.getByLabelText('Только в наличии'))
    expect(onChange).toHaveBeenCalledWith({ inStockOnly: true })

    await user.selectOptions(screen.getByLabelText('Сортировка'), 'price')
    expect(onChange).toHaveBeenCalledWith({ ordering: 'price' })
  })
})
