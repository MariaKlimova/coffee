import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios'
import { Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useAuthStore } from '@entities/user'
import { CatalogPage } from '@pages/CatalogPage'
import { http } from '@shared/api'
import { CATALOG_COPY } from '@shared/lib/copy'
import { renderWithProviders } from '@shared/lib/test/renderWithProviders'
import { ToastProvider } from '@shared/ui'

import { RootLayout } from './RootLayout'

const coffee = {
  id: 'coffee-id',
  name: 'Эфиопия',
  slug: 'ethiopia',
  short_description: 'Цветочный аромат',
  price: '1290.00',
  old_price: null,
  category: 'coffee',
  in_stock: true,
  image_url: null,
  is_favorite: false,
}

function response(config: InternalAxiosRequestConfig, data: unknown): AxiosResponse {
  return { config, data, status: 200, statusText: 'OK', headers: {} }
}

function renderStore(path = '/coffee') {
  return renderWithProviders(
    <ToastProvider>
      <Routes>
        <Route element={<RootLayout />}>
          <Route path="/coffee" element={<CatalogPage category="coffee" />} />
          <Route path="/machines" element={<CatalogPage category="machines" />} />
          <Route path="/cart" element={<div>Корзина</div>} />
        </Route>
      </Routes>
    </ToastProvider>,
    { initialEntries: [path] },
  )
}

describe('Поиск Header → URL → API', () => {
  const adapter = vi.fn()
  let rejectSearch = false
  let pendingSearch: (() => void) | undefined

  beforeEach(() => {
    rejectSearch = false
    pendingSearch = undefined
    adapter.mockReset()
    http.defaults.adapter = adapter
    useAuthStore.setState({
      status: 'guest',
      user: null,
      accessToken: null,
      refreshToken: null,
    })
    adapter.mockImplementation(async (config: InternalAxiosRequestConfig) => {
      if (config.url === '/api/cart/') {
        return response(config, { items: [], items_count: 0, total: '0.00' })
      }
      if (config.url?.endsWith('/related/')) {
        return response(config, [])
      }
      if (config.url === '/api/products/ethiopia/') {
        return response(config, {
          ...coffee,
          description: 'Описание Эфиопии',
          attributes: {},
          images: [],
        })
      }
      const search = config.params?.search as string | undefined
      if (search === 'ожидание') {
        await new Promise<void>((resolve) => {
          pendingSearch = resolve
        })
      }
      if (search && rejectSearch) {
        throw new AxiosError('Ошибка', AxiosError.ERR_NETWORK, config)
      }
      const results = search === 'неттакого' ? [] : [coffee]
      return response(config, {
        count: results.length,
        next: null,
        previous: null,
        results,
      })
    })
  })

  afterEach(() => {
    delete http.defaults.adapter
    vi.restoreAllMocks()
  })

  function expectSearchRequest(search: string, category = 'coffee') {
    expect(adapter).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/api/products/',
        params: expect.objectContaining({ search, category }),
      }),
    )
  }

  it('применяет каждый символ без Enter и сбрасывает страницу и раскрытый товар', async () => {
    const user = userEvent.setup()
    const { router } = renderStore('/coffee?page=2&product=ethiopia&price_min=100')
    await screen.findByText('Описание Эфиопии')

    await user.type(screen.getByRole('searchbox'), '  эфиопия  ')

    await waitFor(() => {
      expectSearchRequest('эфиопия')
    })
    const params = new URLSearchParams(router.state.location.search)
    expect(params.get('search')).toBe('  эфиопия  ')
    expect(params.get('page')).toBeNull()
    expect(params.get('product')).toBeNull()
    expect(params.get('price_min')).toBe('100')
    expect(screen.getByRole('searchbox')).toHaveValue('  эфиопия  ')
    expect(screen.getByRole('searchbox')).toHaveAttribute('enterkeyhint', 'search')
    for (const search of ['э', 'эф', 'эфи', 'эфио', 'эфиоп', 'эфиопи', 'эфиопия']) {
      expectSearchRequest(search)
    }
    const requestsBeforeSubmit = adapter.mock.calls.length
    await user.keyboard('{Enter}')
    await user.click(screen.getByRole('button', { name: CATALOG_COPY.searchSubmit }))
    expect(adapter).toHaveBeenCalledTimes(requestsBeforeSubmit)
  })

  it('сохраняет запрос при смене категории без видимой подписи области', async () => {
    const user = userEvent.setup()
    const { router } = renderStore('/coffee?search=эфиопия&page=2')
    await screen.findByRole('heading', { name: 'Эфиопия' })
    expect(
      screen.getByRole('search', { name: CATALOG_COPY.searchScopeCoffee }),
    ).toBeInTheDocument()

    expect(screen.queryByText(CATALOG_COPY.searchScopeCoffee)).not.toBeInTheDocument()
    const menuTrigger = screen.getByRole('button', { name: 'Меню' })
    await user.click(menuTrigger)
    expect(menuTrigger).toHaveAttribute('aria-expanded', 'true')

    await user.click(
      within(screen.getByRole('navigation', { name: 'Основная навигация' })).getByRole(
        'link',
        { name: 'Кофемашины' },
      ),
    )

    await waitFor(() => {
      expectSearchRequest('эфиопия', 'machines')
    })
    expect(router.state.location.pathname).toBe('/machines')
    expect(menuTrigger).toHaveAttribute('aria-expanded', 'false')
    expect(menuTrigger).toHaveFocus()
    expect(router.state.location.search).not.toContain('page=')
    expect(screen.getByRole('searchbox')).toHaveValue('эфиопия')
    expect(
      screen.getByRole('search', { name: CATALOG_COPY.searchScopeMachines }),
    ).toBeInTheDocument()
  })

  it('из другой страницы ищет в кофе сразу при наборе', async () => {
    const user = userEvent.setup()
    const { router } = renderStore('/cart')
    await user.type(screen.getByRole('searchbox'), 'эфиопия')
    await waitFor(() => {
      expectSearchRequest('эфиопия')
    })
    expect(router.state.location.pathname).toBe('/coffee')
  })

  it('прямая ссылка и повторная загрузка восстанавливают поле и запрос API', async () => {
    const initial = renderStore('/machines?search=  Essenza  ')
    await waitFor(() => {
      expectSearchRequest('Essenza', 'machines')
    })
    expect(screen.getByRole('searchbox')).toHaveValue('  Essenza  ')
    const path =
      initial.router.state.location.pathname + initial.router.state.location.search
    initial.unmount()
    adapter.mockClear()

    renderStore(path)
    await waitFor(() => {
      expectSearchRequest('Essenza', 'machines')
    })
    expect(screen.getByRole('searchbox')).toHaveValue('  Essenza  ')
  })

  it('набор заменяет текущую запись, Back/Forward восстанавливают запросы категорий', async () => {
    const user = userEvent.setup()
    const { router } = renderStore('/coffee?search=эфиопия')
    await screen.findByRole('heading', { name: 'Эфиопия' })
    await user.click(screen.getByRole('link', { name: 'Кофемашины' }))
    await user.type(screen.getByRole('searchbox'), ' новый ')
    expectSearchRequest('эфиопия новый', 'machines')
    await act(() => router.navigate(-1))
    expect(router.state.location.pathname).toBe('/coffee')
    expect(screen.getByRole('searchbox')).toHaveValue('эфиопия')
    await act(() => router.navigate(1))
    expect(router.state.location.pathname).toBe('/machines')
    expect(screen.getByRole('searchbox')).toHaveValue('эфиопия новый ')
  })

  it('Back/Forward восстанавливают поле при открытии товара и после live-изменения запроса', async () => {
    const user = userEvent.setup()
    const { router } = renderStore('/coffee?search=эфиопия')
    await screen.findByRole('heading', { name: 'Эфиопия' })
    await user.click(screen.getByRole('button', { name: 'Эфиопия' }))
    await screen.findByText('Описание Эфиопии')
    await act(() => router.navigate(-1))
    expect(screen.getByRole('searchbox')).toHaveValue('эфиопия')
    expect(router.state.location.search).not.toContain('product=')
    await act(() => router.navigate(1))
    expect(screen.getByRole('searchbox')).toHaveValue('эфиопия')
    expect(router.state.location.search).toContain('product=ethiopia')
    await user.type(screen.getByRole('searchbox'), ' новый')
    expect(screen.getByRole('searchbox')).toHaveValue('эфиопия новый')
    expect(router.state.location.search).not.toContain('product=')
    await act(() => router.navigate(-1))
    expect(screen.getByRole('searchbox')).toHaveValue('эфиопия')
    await act(() => router.navigate(1))
    expect(screen.getByRole('searchbox')).toHaveValue('эфиопия новый')
  })

  it('обычный refetch и повторный render сохраняют введённый текст и фокус', async () => {
    const user = userEvent.setup()
    const { queryClient, router } = renderStore('/coffee?search=эфиопия')
    await screen.findByRole('heading', { name: 'Эфиопия' })
    const input = screen.getByRole('searchbox')
    await user.type(input, ' новый ')
    const originalLocationKey = router.state.location.key
    await act(() => queryClient.invalidateQueries({ queryKey: ['products'] }))
    await act(() => queryClient.invalidateQueries({ queryKey: ['cart'] }))
    expect(router.state.location.key).toBe(originalLocationKey)
    expect(input).toHaveValue('эфиопия новый ')
    expect(input).toHaveFocus()
  })

  it('редактирование середины сохраняет пробелы, фокус и каретку', async () => {
    const user = userEvent.setup()
    const { router } = renderStore('/machines?search=Essenza Mini')
    await screen.findByRole('heading', { name: 'Эфиопия' })
    const input = screen.getByRole('searchbox') as HTMLInputElement
    await user.click(input)
    input.setSelectionRange(7, 7)
    await user.keyboard(' Pro')
    expect(input).toHaveValue('Essenza Pro Mini')
    expect(input).toHaveFocus()
    expect(input.selectionStart).toBe(11)
    expect(new URLSearchParams(router.state.location.search).get('search')).toBe(
      'Essenza Pro Mini',
    )
    expectSearchRequest('Essenza Pro Mini', 'machines')
    await user.keyboard('{Backspace}')
    expect(input).toHaveValue('Essenza Pr Mini')
    expect(input.selectionStart).toBe(10)
    expectSearchRequest('Essenza Pr Mini', 'machines')
  })

  it('IME применяет завершённую композицию без промежуточных запросов', async () => {
    renderStore()
    await screen.findByRole('heading', { name: 'Эфиопия' })
    adapter.mockClear()
    const input = screen.getByRole('searchbox')
    fireEvent.compositionStart(input)
    fireEvent.change(input, { target: { value: 'ケ' } })
    fireEvent.change(input, { target: { value: 'ケニア' } })
    expect(input).toHaveValue('ケニア')
    expect(adapter).not.toHaveBeenCalled()
    fireEvent.compositionEnd(input, { data: 'ケニア' })
    await waitFor(() => expectSearchRequest('ケニア'))
    expect(adapter).toHaveBeenCalledTimes(1)
  })

  it('запоздалый ответ предыдущего символа не заменяет новую выдачу', async () => {
    const user = userEvent.setup()
    let resolveOld!: () => void
    adapter.mockImplementation(async (config: InternalAxiosRequestConfig) => {
      if (config.url === '/api/cart/')
        return response(config, { items: [], items_count: 0, total: '0.00' })
      const search = config.params?.search as string | undefined
      if (search === 'К')
        await new Promise<void>((resolve) => {
          resolveOld = resolve
        })
      const name = search === 'Ке' ? 'Кения новая' : 'Предыдущая выдача'
      return response(config, {
        count: 1,
        next: null,
        previous: null,
        results: [{ ...coffee, name }],
      })
    })
    renderStore()
    await screen.findByRole('heading', { name: 'Предыдущая выдача' })
    await user.type(screen.getByRole('searchbox'), 'Ке')
    expect(
      await screen.findByRole('heading', { name: 'Кения новая' }),
    ).toBeInTheDocument()
    await act(async () => resolveOld())
    expect(screen.getByRole('heading', { name: 'Кения новая' })).toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: 'Предыдущая выдача' }),
    ).not.toBeInTheDocument()
  })

  it('очистка убирает search из URL и API, сохраняя фильтры', async () => {
    const user = userEvent.setup()
    const { router } = renderStore('/coffee?search=эфиопия&price_min=100')
    await screen.findByRole('heading', { name: 'Эфиопия' })
    await user.click(
      within(screen.getByRole('search')).getByRole('button', {
        name: CATALOG_COPY.clearSearch,
      }),
    )

    await waitFor(() => {
      expect(adapter).toHaveBeenLastCalledWith(
        expect.objectContaining({
          params: expect.objectContaining({ price_min: '100' }),
        }),
      )
      expect(adapter.mock.lastCall?.[0].params).not.toHaveProperty('search')
    })
    expect(screen.getByRole('searchbox')).toHaveValue('')
    expect(router.state.location.search).toBe('?price_min=100')
  })

  it('одни пробелы не меняют каталог и не запускают запрос', async () => {
    const user = userEvent.setup()
    const { router } = renderStore()
    await screen.findByRole('heading', { name: 'Эфиопия' })
    adapter.mockClear()
    await user.type(screen.getByRole('searchbox'), '   ')
    expect(adapter).not.toHaveBeenCalled()
    expect(screen.getByRole('searchbox')).toHaveValue('   ')
    expect(new URLSearchParams(router.state.location.search).get('search')).toBe('   ')
    await user.keyboard('{Enter}')
    expect(adapter).not.toHaveBeenCalled()
    expect(router.state.location.search).toBe('')
    expect(screen.getByRole('searchbox')).toHaveValue('')
  })

  it('удаление всего текста возвращает каталог сразу без Enter', async () => {
    const user = userEvent.setup()
    const { router } = renderStore('/coffee?search=эфиопия')
    await screen.findByRole('heading', { name: 'Эфиопия' })
    await user.clear(screen.getByRole('searchbox'))
    await waitFor(() => {
      expect(adapter).toHaveBeenLastCalledWith(
        expect.objectContaining({ url: '/api/products/' }),
      )
      expect(adapter.mock.lastCall?.[0].params).not.toHaveProperty('search')
    })
    expect(router.state.location.search).toBe('')
    expect(screen.getByRole('searchbox')).toHaveValue('')
  })

  it('изменение фильтра сохраняет запрос в URL и API', async () => {
    const user = userEvent.setup()
    const { router } = renderStore('/coffee?search=эфиопия')
    await screen.findByRole('heading', { name: 'Эфиопия' })
    await user.click(
      screen.getByRole('checkbox', { name: CATALOG_COPY.inStockOnlyLabel }),
    )
    await waitFor(() => {
      expect(adapter).toHaveBeenCalledWith(
        expect.objectContaining({
          params: expect.objectContaining({
            search: 'эфиопия',
            in_stock: 'true',
          }),
        }),
      )
    })
    expect(new URLSearchParams(router.state.location.search).get('search')).toBe(
      'эфиопия',
    )
  })

  it('показывает loading, пустую выдачу и возвращает товары после очистки', async () => {
    const user = userEvent.setup()
    renderStore()
    await screen.findByRole('heading', { name: 'Эфиопия' })
    await user.type(screen.getByRole('searchbox'), 'ожидание{Enter}')
    expect(
      await within(screen.getByRole('main')).findByRole('status'),
    ).toHaveTextContent(CATALOG_COPY.loadingLabel)
    await waitFor(() => expect(pendingSearch).toBeTypeOf('function'))
    await act(async () => pendingSearch?.())
    await user.clear(screen.getByRole('searchbox'))
    await user.type(screen.getByRole('searchbox'), 'неттакого{Enter}')
    expect(
      await screen.findByText(CATALOG_COPY.searchEmptyDescription),
    ).toBeInTheDocument()

    await user.click(
      within(screen.getByRole('search')).getByRole('button', {
        name: CATALOG_COPY.clearSearch,
      }),
    )
    expect(await screen.findByRole('heading', { name: 'Эфиопия' })).toBeInTheDocument()
  })

  it('показывает ошибку поиска и повторяет тот же запрос', async () => {
    const user = userEvent.setup()
    rejectSearch = true
    renderStore('/coffee?search=эфиопия')
    expect(await screen.findByText(CATALOG_COPY.errorTitle)).toBeInTheDocument()
    expect(screen.getByRole('searchbox')).toHaveValue('эфиопия')
    rejectSearch = false
    await user.click(screen.getByRole('button', { name: CATALOG_COPY.retry }))
    expect(await screen.findByRole('heading', { name: 'Эфиопия' })).toBeInTheDocument()
    expectSearchRequest('эфиопия')
  })
})
