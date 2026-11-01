import { Outlet, useLocation, useNavigate } from 'react-router-dom'

import { useCart } from '@entities/cart'
import { useFavoritesCount } from '@entities/favorite'
import { getUserDisplayName, useAuthStore } from '@entities/user'
import {
  buildCatalogSearchParams,
  DEFAULT_ORDERING,
  useCatalogParams,
} from '@features/catalog'
import { APP_ROUTES } from '@shared/config'
import { CATALOG_COPY } from '@shared/lib/copy'
import { Footer } from '@shared/ui/Footer'
import { Header } from '@shared/ui/Header'

import styles from './RootLayout.module.css'

/**
 * App shell for store pages: sticky header, page content, footer.
 */
export function RootLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const { params, setSearch } = useCatalogParams()
  const isCatalog =
    location.pathname === APP_ROUTES.coffee || location.pathname === APP_ROUTES.machines
  const searchQuery = isCatalog
    ? (new URLSearchParams(location.search).get('search') ?? '')
    : ''
  const categorySearchParams = new URLSearchParams()
  if (params.search && isCatalog) {
    categorySearchParams.set('search', params.search)
  }
  const catalogSearch = categorySearchParams.size ? `?${categorySearchParams}` : ''

  function search(query: string): void {
    const nextQuery = query
    if (nextQuery === searchQuery) {
      return
    }
    if (isCatalog) {
      setSearch(nextQuery)
      return
    }
    if (!nextQuery.trim()) return
    const next = buildCatalogSearchParams({
      search: nextQuery || undefined,
      inStockOnly: false,
      ordering: DEFAULT_ORDERING,
      page: 1,
      product: null,
    })
    next.set('search', nextQuery)
    void navigate({
      pathname: APP_ROUTES.coffee,
      search: next.toString(),
    })
  }

  const user = useAuthStore((state) => state.user)
  const status = useAuthStore((state) => state.status)
  const logout = useAuthStore((state) => state.logout)
  const favoritesCountQuery = useFavoritesCount()
  const favoritesCount =
    status === 'authenticated' ? (favoritesCountQuery.data ?? 0) : 0
  const cartQuery = useCart()
  const cartCount = cartQuery.data?.items_count ?? 0

  return (
    <div className={styles.RootLayout}>
      <Header
        favoritesCount={favoritesCount}
        cartCount={cartCount}
        user={user ? { name: getUserDisplayName(user) } : null}
        searchQuery={searchQuery}
        searchLocationKey={location.key}
        searchScope={
          location.pathname === APP_ROUTES.machines
            ? CATALOG_COPY.searchScopeMachines
            : CATALOG_COPY.searchScopeCoffee
        }
        catalogSearch={catalogSearch}
        onSearchSubmit={search}
        onSearchChange={search}
        onSearchClear={() => {
          search('')
        }}
        onLogout={() => {
          void logout()
        }}
      />
      <main className={styles['RootLayout-Main']}>
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}
