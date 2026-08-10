import { GuestAuthPage, LoginForm } from '@features/auth'

export function LoginPage() {
  return (
    <GuestAuthPage>
      {({ onSuccess }) => <LoginForm onSuccess={onSuccess} />}
    </GuestAuthPage>
  )
}
