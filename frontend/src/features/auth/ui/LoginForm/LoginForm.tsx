import { useState } from 'react'

import { useAuthStore } from '@entities/user'
import { Button } from '@shared/ui/Button'
import { Input } from '@shared/ui/Input'

import { AUTH_COPY } from '../../auth.const'
import { useAuthFormSubmit } from '../../lib/useAuthFormSubmit'
import { validateLoginForm } from '../../lib/validateAuthForm'
import { AuthCard } from '../AuthCard'
import type { LoginFormProps } from './LoginForm.typings'
import styles from './LoginForm.module.css'

export function LoginForm({ onSuccess }: LoginFormProps) {
  const login = useAuthStore((state) => state.login)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const { fieldErrors, formError, isSubmitting, clearFieldError, handleSubmit } =
    useAuthFormSubmit({
      kind: 'login',
      validate: validateLoginForm,
      submit: (values) =>
        login({ email: values.email.trim(), password: values.password }),
      onSuccess,
    })

  return (
    <AuthCard
      title={AUTH_COPY.loginTitle}
      formError={formError}
      footerPrompt={AUTH_COPY.loginFooterPrompt}
      footerLinkLabel={AUTH_COPY.loginFooterLink}
      footerTo="/register"
    >
      <form
        className={styles.LoginForm}
        onSubmit={(event) => {
          void handleSubmit(event, { email, password })
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
          autoComplete="current-password"
          value={password}
          errorText={fieldErrors.password}
          disabled={isSubmitting}
          onChange={(event) => {
            setPassword(event.target.value)
            clearFieldError('password')
          }}
        />
        <Button
          type="submit"
          loading={isSubmitting}
          className={styles['LoginForm-Submit']}
        >
          {AUTH_COPY.loginSubmit}
        </Button>
      </form>
    </AuthCard>
  )
}
