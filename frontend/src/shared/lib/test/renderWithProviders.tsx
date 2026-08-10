import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, type RenderOptions, type RenderResult } from '@testing-library/react'
import type { ReactElement } from 'react'
import {
  createMemoryRouter,
  RouterProvider,
  type MemoryRouterProps,
} from 'react-router-dom'

interface RenderWithProvidersOptions extends Omit<RenderOptions, 'wrapper'> {
  /** Initial history entries for the memory router. */
  initialEntries?: MemoryRouterProps['initialEntries']
  /** Optional QueryClient override (defaults to a no-retry client). */
  queryClient?: QueryClient
}

interface RenderWithProvidersResult extends RenderResult {
  /** QueryClient used by the rendered tree. */
  queryClient: QueryClient
  /** Memory router instance (for asserting location.search). */
  router: ReturnType<typeof createMemoryRouter>
}

function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        refetchOnWindowFocus: false,
      },
    },
  })
}

/**
 * Renders UI with React Query and a memory router — the usual catalog test shell.
 */
export function renderWithProviders(
  ui: ReactElement,
  {
    initialEntries = ['/'],
    queryClient = createTestQueryClient(),
    ...renderOptions
  }: RenderWithProvidersOptions = {},
): RenderWithProvidersResult {
  const router = createMemoryRouter([{ path: '*', element: ui }], {
    initialEntries,
  })

  return {
    ...render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
      renderOptions,
    ),
    queryClient,
    router,
  }
}
