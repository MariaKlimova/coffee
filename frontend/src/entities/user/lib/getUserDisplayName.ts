import type { AuthUser } from '../api/authApi.typings'

/**
 * Picks a short display name for the header account control.
 */
export function getUserDisplayName(user: AuthUser): string {
  const firstName = user.first_name?.trim()
  if (firstName) {
    return firstName
  }
  const atIndex = user.email.indexOf('@')
  if (atIndex > 0) {
    return user.email.slice(0, atIndex)
  }
  return user.email
}
