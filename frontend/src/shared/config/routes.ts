/**
 * Canonical in-app paths. Storefront, header, router and product entity read from here.
 */
export const APP_ROUTES = {
  /** Home / landing. */
  home: '/',
  /** Coffee category storefront. */
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
  /** Checkout (auth). */
  checkout: '/checkout',
  /** Profile (auth). */
  profile: '/profile',
  /** Contacts anchor on the home page. */
  contacts: '/#contacts',
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
