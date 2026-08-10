import { describe, expect, it } from 'vitest'

import { buildPageItems } from './buildPageItems'

describe('buildPageItems', () => {
  it('returns a single page when total is 1', () => {
    expect(buildPageItems(1, 1)).toEqual([{ type: 'page', page: 1 }])
  })

  it('truncates with ellipsis for large ranges', () => {
    expect(buildPageItems(5, 12)).toEqual([
      { type: 'page', page: 1 },
      { type: 'ellipsis', key: 'ellipsis-1-4' },
      { type: 'page', page: 4 },
      { type: 'page', page: 5 },
      { type: 'page', page: 6 },
      { type: 'ellipsis', key: 'ellipsis-6-12' },
      { type: 'page', page: 12 },
    ])
  })

  it('keeps edges without ellipsis when the window covers them', () => {
    expect(buildPageItems(1, 3)).toEqual([
      { type: 'page', page: 1 },
      { type: 'page', page: 2 },
      { type: 'page', page: 3 },
    ])
  })
})
