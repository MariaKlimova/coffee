import { describe, expect, it } from 'vitest'

import { getRedirectPath } from './getRedirectPath'

describe('getRedirectPath', () => {
  it('returns the saved path from location state', () => {
    expect(
      getRedirectPath({
        from: {
          pathname: '/favorites',
          search: '?tab=1',
          hash: '',
          state: null,
          key: 'default',
        },
      }),
    ).toBe('/favorites?tab=1')
  })

  it('falls back when state is missing', () => {
    expect(getRedirectPath(null)).toBe('/')
    expect(getRedirectPath(undefined, '/coffee')).toBe('/coffee')
  })
})
