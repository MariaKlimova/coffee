import { GuestAuthPage, RegisterForm } from '@features/auth'

export function RegisterPage() {
  return (
    <GuestAuthPage>
      {({ onSuccess }) => <RegisterForm onSuccess={onSuccess} />}
    </GuestAuthPage>
  )
}
