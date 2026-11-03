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

  it('preserves a management deep link with its own query and hash', () => {
    expect(
      getRedirectPath({
        from: {
          pathname: '/manage/products/product-id/edit',
          search: '?tab=photos',
          hash: '#details',
        },
      }),
    ).toBe('/manage/products/product-id/edit?tab=photos#details')
  })

  it.each([
    '/manage/orders?search=6060&page=2#results',
    '/manage/orders/ac2f449c-9de4-44be-a15f-12f258e74001?search=6060#attempts',
  ])('preserves the order management return URL: %s', (path) => {
    const location = new URL(path, 'https://coffee.invalid')
    expect(
      getRedirectPath(
        {
          from: {
            pathname: location.pathname,
            search: location.search,
            hash: location.hash,
          },
        },
        '/coffee',
      ),
    ).toBe(path)
  })

  it.each([
    'https://example.com',
    '//example.com',
    '/\\example.com',
    '/unknown',
    '/login',
    '/register',
    '/manage/../login',
    '/manage/products/../new',
    '/manage/products/new?next=//example.com',
    '/manage/orders/../login',
    '/manage/orders/%2e%2e',
    '/manage/orders//example.com',
    '/manage/orders?next=//example.com',
  ])('rejects an unsafe or unsupported pathname: %s', (pathname) => {
    expect(getRedirectPath({ from: { pathname } })).toBe('/')
  })

  it.each([
    { pathname: '/manage', search: '//example.com' },
    { pathname: '/manage', search: '?tab=photos#injected' },
    { pathname: '/manage', hash: '?tab=photos' },
    { pathname: '/manage', search: '?tab=\\photos' },
    { pathname: '/manage', search: '?tab=\nphotos' },
  ])('rejects malformed search/hash attached to a valid path', (from) => {
    expect(getRedirectPath({ from }, '/coffee')).toBe('/coffee')
  })

  it('falls back when state is missing', () => {
    expect(getRedirectPath(null)).toBe('/')
    expect(getRedirectPath(undefined, '/coffee')).toBe('/coffee')
  })
})
