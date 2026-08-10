import { type FormEvent, useState } from 'react'

import type { AuthFieldName } from '../auth.const'
import { mapAuthApiError, type AuthFormKind } from './mapAuthApiError'
import { hasAuthFieldErrors, type AuthFieldErrors } from './validateAuthForm'

/**
 * Options for the shared auth form submit helper.
 */
export interface UseAuthFormSubmitOptions<TValues> {
  /** Which auth endpoint semantics to use for error mapping. */
  kind: AuthFormKind
  /** Client-side validator for the current form values. */
  validate: (values: TValues) => AuthFieldErrors
  /** Async API call that persists the session on success. */
  submit: (values: TValues) => Promise<void>
  /** Called after a successful submit. */
  onSuccess: () => void
}

/**
 * Shared submit/error state for login and register forms.
 */
export function useAuthFormSubmit<TValues>({
  kind,
  validate,
  submit,
  onSuccess,
}: UseAuthFormSubmitOptions<TValues>) {
  const [fieldErrors, setFieldErrors] = useState<AuthFieldErrors>({})
  const [formError, setFormError] = useState<string | undefined>()
  const [isSubmitting, setIsSubmitting] = useState(false)

  function clearFieldError(field: AuthFieldName) {
    setFieldErrors((current) => {
      if (!current[field]) {
        return current
      }
      const next = { ...current }
      delete next[field]
      return next
    })
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>, values: TValues) {
    event.preventDefault()
    if (isSubmitting) {
      return
    }

    const nextErrors = validate(values)
    if (hasAuthFieldErrors(nextErrors)) {
      setFieldErrors(nextErrors)
      setFormError(undefined)
      return
    }

    setIsSubmitting(true)
    setFormError(undefined)
    setFieldErrors({})

    try {
      await submit(values)
      onSuccess()
    } catch (error) {
      const view = mapAuthApiError(error, kind)
      setFormError(view.formError)
      setFieldErrors(view.fieldErrors)
    } finally {
      setIsSubmitting(false)
    }
  }

  return {
    fieldErrors,
    formError,
    isSubmitting,
    clearFieldError,
    handleSubmit,
  }
}
