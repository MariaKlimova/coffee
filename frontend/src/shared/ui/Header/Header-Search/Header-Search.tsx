import { type FormEvent, useRef, useState } from 'react'

import { CATALOG_COPY } from '@shared/lib/copy'
import { cx } from '@shared/lib/cx'
import { Button } from '@shared/ui/Button'
import { SearchIcon } from '@shared/ui/icons'
import { Input } from '@shared/ui/Input'

import type { HeaderSearchProps } from './Header-Search.typings'
import styles from './Header-Search.module.css'

export function HeaderSearch({
  query = '',
  locationKey = '',
  scope = CATALOG_COPY.searchScopeCoffee,
  onSubmit,
  onChange,
  onClear,
  className,
}: HeaderSearchProps) {
  const [draft, setDraft] = useState({
    source: query,
    scope,
    locationKey,
    value: query,
  })
  const formRef = useRef<HTMLFormElement>(null)
  const isComposing = useRef(false)
  // При навигации восстанавливаем URL до отрисовки, сохраняя фокус поля.
  const isCurrentLocation =
    draft.source === query && draft.scope === scope && draft.locationKey === locationKey
  if (!isCurrentLocation) {
    setDraft({ source: query, scope, locationKey, value: query })
  }
  const value = isCurrentLocation ? draft.value : query

  const clear = () => {
    setDraft({ source: query, scope, locationKey, value: '' })
    onClear?.()
    formRef.current?.querySelector('input')?.focus()
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (isComposing.current) return
    const trimmed = value.trim()
    setDraft({ source: query, scope, locationKey, value: trimmed })
    onSubmit?.(trimmed)
  }

  return (
    <form
      className={cx(styles['Header-Search'], className)}
      role="search"
      aria-label={scope}
      ref={formRef}
      onSubmit={handleSubmit}
    >
      <div className={styles['Header-SearchControls']}>
        <Input
          type="search"
          enterKeyHint="search"
          name="search"
          value={value}
          onChange={(event) => {
            const next = event.target.value
            setDraft({ source: query, scope, locationKey, value: next })
            if (!isComposing.current) onChange?.(next)
          }}
          onCompositionStart={() => {
            isComposing.current = true
          }}
          onCompositionEnd={(event) => {
            isComposing.current = false
            onChange?.(event.currentTarget.value)
          }}
          placeholder={CATALOG_COPY.searchPlaceholder}
          aria-label={CATALOG_COPY.searchLabel}
          className={styles['Header-SearchField']}
        />
        {value || query ? (
          <Button
            type="button"
            variant="ghost"
            onClick={clear}
            aria-label={CATALOG_COPY.clearSearch}
            className={styles['Header-SearchButton']}
          >
            <span aria-hidden>×</span>
          </Button>
        ) : null}
        <Button
          type="submit"
          aria-label={CATALOG_COPY.searchSubmit}
          className={styles['Header-SearchButton']}
        >
          <SearchIcon />
        </Button>
      </div>
    </form>
  )
}
