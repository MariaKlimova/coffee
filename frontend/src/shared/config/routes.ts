/**
 * Canonical in-app paths. Storefront, header, router and product entity read from here.
 */
export const APP_ROUTES = {
  /** Root URL — redirects to the coffee catalog. */
  home: '/',
  /** Coffee category storefront (main storefront). */
  coffee: '/coffee',
  /** Machines category storefront. */
  machines: '/machines',
  /** Product deep-link pattern for the router. */
  product: '/product/:slug',
  /** Cart. */
  cart: '/cart',
  /** Login. */
  login: '/login',
  /** Register. */
  register: '/register',
  /** Favorites (auth). */
  favorites: '/favorites',
  /** Checkout (guest + auth). */
  checkout: '/checkout',
  /** Payment return / order result after YooKassa. */
  checkoutResult: '/checkout/result',
  /** Profile (auth). */
  profile: '/profile',
  /** Orders list (auth). */
  orders: '/orders',
  /** Order detail pattern for the router (auth). */
  orderDetail: '/orders/:id',
  /** Contacts anchor (пока без отдельной страницы). */
  contacts: '/coffee#contacts',
  /** Design-system playground (DEV only). */
  uiKit: '/dev/ui-kit',
} as const

/**
 * Category slug → storefront path (same values as `APP_ROUTES.coffee` / `.machines`).
 */
export const CATEGORY_PATHS = {
  coffee: APP_ROUTES.coffee,
  machines: APP_ROUTES.machines,
} as const

/**
 * Путь деталки заказа по UUID.
 */
export function orderDetailPath(orderId: string): string {
  return `${APP_ROUTES.orders}/${orderId}`
}
