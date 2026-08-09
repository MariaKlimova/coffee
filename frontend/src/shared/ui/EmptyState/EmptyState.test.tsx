import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { Button } from '@shared/ui/Button'
import { EmptyState } from '@shared/ui/EmptyState'

describe('EmptyState', () => {
  it('renders title, description and action', () => {
    render(
      <EmptyState
        title="Корзина пока пуста"
        description="Добавь кофе из каталога"
        action={<Button>В каталог</Button>}
      />,
    )

    expect(
      screen.getByRole('heading', { name: 'Корзина пока пуста' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Добавь кофе из каталога')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'В каталог' })).toBeInTheDocument()
  })
})
