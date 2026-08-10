import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import { Footer } from '@shared/ui/Footer'

describe('Footer', () => {
  it('renders key links and contacts', () => {
    render(
      <MemoryRouter>
        <Footer />
      </MemoryRouter>,
    )

    expect(screen.getByRole('link', { name: 'Доставка и оплата' })).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Политика конфиденциальности' }),
    ).toBeInTheDocument()
    expect(screen.getByText('hello@coffeeshop.example')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Telegram' })).toBeInTheDocument()
  })
})
