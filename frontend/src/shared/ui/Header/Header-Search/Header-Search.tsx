import { type FormEvent, useState } from 'react'

import { cx } from '@shared/lib/cx'
import { SearchIcon } from '@shared/ui/icons'
import { Input } from '@shared/ui/Input'

import type { HeaderSearchProps } from './Header-Search.typings'
import styles from './Header-Search.module.css'

export function HeaderSearch({ onSubmit, className }: HeaderSearchProps) {
  const [query, setQuery] = useState('')

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    onSubmit?.(query.trim())
  }

  return (
    <form
      className={cx(styles['Header-Search'], className)}
      role="search"
      onSubmit={handleSubmit}
    >
      <Input
        type="search"
        name="q"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value)
        }}
        placeholder="Найди кофе или кофемашину"
        aria-label="Поиск"
        icon={<SearchIcon />}
        className={styles['Header-SearchField']}
      />
    </form>
  )
}
