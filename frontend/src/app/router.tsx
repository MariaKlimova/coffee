import { createBrowserRouter, type RouteObject } from 'react-router-dom'

import { RootLayout } from '@app/layouts/RootLayout'
import { RequireAuth } from '@app/routes/RequireAuth'
import { CartPage } from '@pages/CartPage'
import { CheckoutPage } from '@pages/CheckoutPage'
import { CoffeePage } from '@pages/CoffeePage'
import { FavoritesPage } from '@pages/FavoritesPage'
import { HomePage } from '@pages/HomePage'
import { LoginPage } from '@pages/LoginPage'
import { MachinesPage } from '@pages/MachinesPage'
import { ProductPage } from '@pages/ProductPage'
import { ProfilePage } from '@pages/ProfilePage'
import { RegisterPage } from '@pages/RegisterPage'
import { APP_ROUTES } from '@shared/config'

const appRoutes: RouteObject[] = [
  {
    element: <RootLayout />,
    children: [
      { path: APP_ROUTES.home, element: <HomePage /> },
      { path: APP_ROUTES.coffee, element: <CoffeePage /> },
      { path: APP_ROUTES.machines, element: <MachinesPage /> },
      { path: APP_ROUTES.product, element: <ProductPage /> },
      { path: APP_ROUTES.cart, element: <CartPage /> },
      { path: APP_ROUTES.login, element: <LoginPage /> },
      { path: APP_ROUTES.register, element: <RegisterPage /> },
      {
        element: <RequireAuth />,
        children: [
          { path: APP_ROUTES.favorites, element: <FavoritesPage /> },
          { path: APP_ROUTES.checkout, element: <CheckoutPage /> },
          { path: APP_ROUTES.profile, element: <ProfilePage /> },
        ],
      },
    ],
  },
]

if (import.meta.env.DEV) {
  appRoutes.push({
    path: APP_ROUTES.uiKit,
    lazy: async () => {
      const { UiKitPage } = await import('@pages/UiKitPage')
      return { Component: UiKitPage }
    },
  })
}

export const router = createBrowserRouter(appRoutes)
