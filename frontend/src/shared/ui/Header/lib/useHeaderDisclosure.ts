import { useEffect, useRef, useState } from 'react'

/** Общее закрытие раскрываемых панелей шапки и восстановление фокуса. */
export function useHeaderDisclosure() {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  const closeAndRestoreFocus = () => {
    setOpen(false)
    // При выборе обычной desktop-ссылки скрытая кнопка не получает фокус.
    if (open) triggerRef.current?.focus()
  }

  useEffect(() => {
    if (!open) return

    const onOutsideInteraction = (event: PointerEvent | FocusEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        setOpen(false)
        triggerRef.current?.focus()
      }
    }

    document.addEventListener('pointerdown', onOutsideInteraction)
    document.addEventListener('focusin', onOutsideInteraction)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onOutsideInteraction)
      document.removeEventListener('focusin', onOutsideInteraction)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return { open, setOpen, rootRef, triggerRef, closeAndRestoreFocus }
}
