import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { Select } from '@shared/ui/Select'

const options = [
  { value: 'coffee', label: 'Кофе' },
  { value: 'machines', label: 'Кофемашины' },
]

describe('Select', () => {
  it('keeps the native label, form value, helper and selection behavior', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <Select
        id="category"
        name="category"
        label="Категория"
        helperText="Выбери категорию"
        defaultValue="coffee"
        options={options}
        onChange={onChange}
      />,
    )

    const field = screen.getByRole('combobox', { name: 'Категория' })
    expect(field).toHaveAttribute('id', 'category')
    expect(field).toHaveAttribute('name', 'category')
    expect(field).toHaveAccessibleDescription('Выбери категорию')
    expect(field).toHaveValue('coffee')
    await user.tab()
    expect(field).toHaveFocus()
    await user.selectOptions(field, 'machines')
    expect(field).toHaveValue('machines')
    expect(onChange).toHaveBeenCalledOnce()
    expect(screen.getAllByRole('combobox')).toHaveLength(1)
  })

  it('preserves controlled values and disabled placeholder', async () => {
    const user = userEvent.setup()
    function ControlledSelect() {
      const [value, setValue] = useState('')
      return (
        <Select
          aria-label="Категория"
          placeholder="Все категории"
          options={options}
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
      )
    }
    render(<ControlledSelect />)

    const field = screen.getByRole('combobox', { name: 'Категория' })
    expect(field).toHaveValue('')
    expect(screen.getByRole('option', { name: 'Все категории' })).toBeDisabled()
    await user.selectOptions(field, 'coffee')
    expect(field).toHaveValue('coffee')
  })

  it('keeps error feedback and disabled behavior on the actual select', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <Select
        label="Категория"
        options={options}
        defaultValue="coffee"
        errorText="Проверь категорию"
        disabled
        onChange={onChange}
      />,
    )

    const field = screen.getByLabelText('Категория')
    expect(field).toBeDisabled()
    expect(field).toHaveAttribute('aria-invalid', 'true')
    expect(field).toHaveAccessibleDescription('Проверь категорию')
    expect(screen.getByRole('alert')).toHaveTextContent('Проверь категорию')
    await user.selectOptions(field, 'machines')
    expect(field).toHaveValue('coffee')
    expect(onChange).not.toHaveBeenCalled()
  })

  it.each([{ multiple: true }, { size: 3 }])(
    'preserves listbox attributes for %j',
    (props) => {
      render(<Select aria-label="Категория" options={options} {...props} />)

      const field = screen.getByRole('listbox', { name: 'Категория' })
      if ('multiple' in props) expect(field).toHaveAttribute('multiple')
      if ('size' in props) expect(field).toHaveAttribute('size', '3')
      expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    },
  )
})
