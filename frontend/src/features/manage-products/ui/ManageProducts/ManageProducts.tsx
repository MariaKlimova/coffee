import { useSearchParams } from 'react-router-dom'

import { CATEGORY_LABELS, type ProductCategorySlug } from '@entities/product'
import { APP_ROUTES } from '@shared/config'
import { CATALOG_COPY, MANAGE_COPY } from '@shared/lib/copy'
import { Button } from '@shared/ui/Button'
import { Input } from '@shared/ui/Input'
import { Select } from '@shared/ui/Select'
import { EmptyState } from '@shared/ui/EmptyState'

import { MANAGE_PAGE_SIZE, type ManageFilters } from '../../api/manageCatalogApi'
import { useManageCatalog } from '../../model/useManageCatalog'
import { ManageDemo } from '../ManageDemo'
import { ManageProductRow } from '../ManageProductRow'
import styles from './ManageProducts.module.css'

export function ManageProducts() {
  const [params, setParams] = useSearchParams()
  const category = params.get('category')
  const publication = params.get('is_published')
  const requestedPage = Number(params.get('page') ?? 1)
  const filters: ManageFilters = {
    category: category === 'coffee' || category === 'machines' ? category : '',
    is_published: publication === 'true' || publication === 'false' ? publication : '',
    search: params.get('search') ?? '',
    page: Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1,
  }
  const { products, catalog, changeProduct, disableDemo } = useManageCatalog(filters)
  function update(changes: Record<string, string>) {
    const next = new URLSearchParams(params)
    next.delete('page')
    Object.entries(changes).forEach(([key, value]) => {
      if (value) next.set(key, value)
      else next.delete(key)
    })
    setParams(next)
  }
  const totalPages = Math.max(
    1,
    Math.ceil((products.data?.count ?? 0) / MANAGE_PAGE_SIZE),
  )
  return (
    <section className={styles.ManageProducts}>
      <header className={styles['ManageProducts-Header']}>
        <div>
          <h1>{MANAGE_COPY.productsTitle}</h1>
          <p>{MANAGE_COPY.productsDescription}</p>
        </div>
        <Button to={APP_ROUTES.manageProductNew}>{MANAGE_COPY.addProduct}</Button>
      </header>
      {catalog.data && <ManageDemo catalog={catalog.data} onDisable={disableDemo} />}
      {catalog.isError && (
        <div role="alert">
          <p>{MANAGE_COPY.demoError}</p>
          <Button
            variant="ghost"
            onClick={() => {
              void catalog.refetch()
            }}
          >
            {CATALOG_COPY.retry}
          </Button>
        </div>
      )}
      <form
        className={styles['ManageProducts-Filters']}
        onSubmit={(event) => {
          event.preventDefault()
          const search = new FormData(event.currentTarget).get('search')
          update({ search: typeof search === 'string' ? search.trim() : '' })
        }}
      >
        <Input
          label={CATALOG_COPY.searchLabel}
          placeholder={CATALOG_COPY.searchPlaceholder}
          key={filters.search}
          name="search"
          defaultValue={filters.search}
        />
        <Select
          label={MANAGE_COPY.category}
          value={filters.category}
          onChange={(event) => update({ category: event.target.value })}
          options={[
            { value: '', label: MANAGE_COPY.allCategories },
            ...Object.entries(CATEGORY_LABELS).map(([value, label]) => ({
              value: value as ProductCategorySlug,
              label,
            })),
          ]}
        />
        <Select
          label={MANAGE_COPY.publication}
          value={filters.is_published}
          onChange={(event) => update({ is_published: event.target.value })}
          options={[
            { value: '', label: MANAGE_COPY.allPublications },
            { value: 'true', label: MANAGE_COPY.published },
            { value: 'false', label: MANAGE_COPY.unpublished },
          ]}
        />
        <Button type="submit" variant="secondary">
          {CATALOG_COPY.searchSubmit}
        </Button>
        <Button
          variant="ghost"
          onClick={(event) => {
            event.currentTarget.form?.reset()
            setParams({})
          }}
        >
          {CATALOG_COPY.resetFilters}
        </Button>
      </form>
      {products.isPending && <p role="status">{CATALOG_COPY.loadingLabel}</p>}
      {products.isError && (
        <EmptyState
          title={CATALOG_COPY.errorTitle}
          description={CATALOG_COPY.errorDescription}
          action={
            <Button
              onClick={() => {
                void products.refetch()
              }}
            >
              {CATALOG_COPY.retry}
            </Button>
          }
        />
      )}
      {!products.isError && products.data?.results.length === 0 && (
        <EmptyState
          title={CATALOG_COPY.emptyTitle}
          description={CATALOG_COPY.emptyDescription}
          action={
            <Button
              variant="secondary"
              onClick={() => {
                setParams({})
              }}
            >
              {CATALOG_COPY.resetFilters}
            </Button>
          }
        />
      )}
      {!products.isError && products.data && (
        <ul className={styles['ManageProducts-List']} aria-busy={products.isFetching}>
          {products.data.results.map((product) => (
            <ManageProductRow
              key={product.id}
              product={product}
              onSave={changeProduct}
            />
          ))}
        </ul>
      )}
      {products.data && (totalPages > 1 || filters.page > 1) && (
        <nav
          className={styles['ManageProducts-Pagination']}
          aria-label={MANAGE_COPY.pagination}
        >
          <Button
            variant="secondary"
            disabled={filters.page <= 1 || products.isFetching}
            onClick={() => update({ page: String(filters.page - 1) })}
          >
            {MANAGE_COPY.previousPage}
          </Button>
          <span>{MANAGE_COPY.page(filters.page, totalPages)}</span>
          <Button
            variant="secondary"
            disabled={!products.data.next || products.isFetching}
            onClick={() => update({ page: String(filters.page + 1) })}
          >
            {MANAGE_COPY.nextPage}
          </Button>
        </nav>
      )}
    </section>
  )
}
