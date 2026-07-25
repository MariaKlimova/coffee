import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { Input } from '@shared/ui/Input'

describe('Input', () => {
  it('associates the label with the field', () => {
    render(<Input label="Поиск" placeholder="Название кофе" />)

    expect(screen.getByLabelText('Поиск')).toBeInTheDocument()
  })

  it('shows error text and marks the field invalid', () => {
    render(<Input label="Email" errorText="Проверь адрес почты" />)

    expect(screen.getByRole('alert')).toHaveTextContent('Проверь адрес почты')
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true')
  })
})
