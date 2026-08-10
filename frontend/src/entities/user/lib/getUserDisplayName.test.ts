import { describe, expect, it } from 'vitest'

import { getUserDisplayName } from './getUserDisplayName'

describe('getUserDisplayName', () => {
  it('prefers first_name when present', () => {
    expect(
      getUserDisplayName({
        id: 'u1',
        email: 'masha@example.com',
        first_name: ' Маша ',
      }),
    ).toBe('Маша')
  })

  it('falls back to the email local-part when first_name is missing', () => {
    expect(
      getUserDisplayName({
        id: 'u1',
        email: 'masha@example.com',
      }),
    ).toBe('masha')
  })
})
