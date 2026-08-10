import { describe, expect, it } from 'vitest'

import { shouldRedirectOnSessionExpired } from './sessionExpiredRedirect'

describe('shouldRedirectOnSessionExpired', () => {
  it('redirects only for a mid-session authenticated expiry', () => {
    expect(shouldRedirectOnSessionExpired('authenticated')).toBe(true)
  })

  it('does not redirect during soft restore or guest idle', () => {
    expect(shouldRedirectOnSessionExpired('restoring')).toBe(false)
    expect(shouldRedirectOnSessionExpired('idle')).toBe(false)
    expect(shouldRedirectOnSessionExpired('guest')).toBe(false)
  })
})
