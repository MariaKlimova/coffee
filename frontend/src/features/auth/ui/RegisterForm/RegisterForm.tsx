import { useState } from 'react'

import { useAuthStore } from '@entities/user'
import { Button } from '@shared/ui/Button'
import { Input } from '@shared/ui/Input'

import { AUTH_COPY } from '../../auth.const'
import { useAuthFormSubmit } from '../../lib/useAuthFormSubmit'
import { validateRegisterForm } from '../../lib/validateAuthForm'
import { AuthCard } from '../AuthCard'
import type { RegisterFormProps } from './RegisterForm.typings'
import styles from './RegisterForm.module.css'

export function RegisterForm({ onSuccess }: RegisterFormProps) {
  const register = useAuthStore((state) => state.register)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')

  const { fieldErrors, formError, isSubmitting, clearFieldError, handleSubmit } =
    useAuthFormSubmit({
      kind: 'register',
      validate: validateRegisterForm,
      submit: (values) =>
        register({
          email: values.email.trim(),
          password: values.password,
          password_confirm: values.password_confirm,
        }),
      onSuccess,
    })

  return (
    <AuthCard
      title={AUTH_COPY.registerTitle}
      formError={formError}
      footerPrompt={AUTH_COPY.registerFooterPrompt}
      footerLinkLabel={AUTH_COPY.registerFooterLink}
      footerTo="/login"
    >
      <form
        className={styles.RegisterForm}
        onSubmit={(event) => {
          void handleSubmit(event, {
            email,
            password,
            password_confirm: passwordConfirm,
          })
        }}
        noValidate
      >
        <Input
          label={AUTH_COPY.emailLabel}
          type="email"
          name="email"
          autoComplete="email"
          value={email}
          errorText={fieldErrors.email}
          disabled={isSubmitting}
          onChange={(event) => {
            setEmail(event.target.value)
            clearFieldError('email')
          }}
        />
        <Input
          label={AUTH_COPY.passwordLabel}
          type="password"
          name="password"
          autoComplete="new-password"
          value={password}
          errorText={fieldErrors.password}
          disabled={isSubmitting}
          onChange={(event) => {
            setPassword(event.target.value)
            clearFieldError('password')
          }}
        />
        <Input
          label={AUTH_COPY.passwordConfirmLabel}
          type="password"
          name="password_confirm"
          autoComplete="new-password"
          value={passwordConfirm}
          errorText={fieldErrors.password_confirm}
          disabled={isSubmitting}
          onChange={(event) => {
            setPasswordConfirm(event.target.value)
            clearFieldError('password_confirm')
          }}
        />
        <Button
          type="submit"
          loading={isSubmitting}
          className={styles['RegisterForm-Submit']}
        >
          {AUTH_COPY.registerSubmit}
        </Button>
      </form>
    </AuthCard>
  )
}
