import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { CatalogPagination } from './CatalogPagination'

describe('CatalogPagination', () => {
  it('disables edge buttons and marks the current page', () => {
    const onPageChange = vi.fn()

    render(
      <CatalogPagination
        page={1}
        count={60}
        pageSize={20}
        onPageChange={onPageChange}
      />,
    )

    expect(screen.getByRole('button', { name: 'Назад' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Вперёд' })).not.toBeDisabled()
    expect(screen.getByRole('button', { name: '1' })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })

  it('calls onPageChange for numbered and next buttons', async () => {
    const user = userEvent.setup()
    const onPageChange = vi.fn()

    render(
      <CatalogPagination
        page={2}
        count={60}
        pageSize={20}
        onPageChange={onPageChange}
      />,
    )

    await user.click(screen.getByRole('button', { name: '3' }))
    expect(onPageChange).toHaveBeenCalledWith(3)

    await user.click(screen.getByRole('button', { name: 'Вперёд' }))
    expect(onPageChange).toHaveBeenCalledWith(3)
  })

  it('renders nothing when there is only one page', () => {
    const { container } = render(
      <CatalogPagination
        page={1}
        count={10}
        pageSize={20}
        onPageChange={() => undefined}
      />,
    )
    expect(container).toBeEmptyDOMElement()
  })
})
