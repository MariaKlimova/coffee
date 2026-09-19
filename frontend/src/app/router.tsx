import { createBrowserRouter, Navigate, type RouteObject } from 'react-router-dom'

import { RootLayout } from '@app/layouts/RootLayout'
import { RequireAuth } from '@app/routes/RequireAuth'
import { CartPage } from '@pages/CartPage'
import { CheckoutPage } from '@pages/CheckoutPage'
import { CheckoutResultPage } from '@pages/CheckoutResultPage'
import { CoffeePage } from '@pages/CoffeePage'
import { FavoritesPage } from '@pages/FavoritesPage'
import { LoginPage } from '@pages/LoginPage'
import { MachinesPage } from '@pages/MachinesPage'
import { OrderDetailPage } from '@pages/OrderDetailPage'
import { OrdersPage } from '@pages/OrdersPage'
import { ProductPage } from '@pages/ProductPage'
import { ProfilePage } from '@pages/ProfilePage'
import { RegisterPage } from '@pages/RegisterPage'
import { APP_ROUTES } from '@shared/config'

const appRoutes: RouteObject[] = [
  {
    element: <RootLayout />,
    children: [
      {
        path: APP_ROUTES.home,
        element: <Navigate to={APP_ROUTES.coffee} replace />,
      },
      { path: APP_ROUTES.coffee, element: <CoffeePage /> },
      { path: APP_ROUTES.machines, element: <MachinesPage /> },
      { path: APP_ROUTES.product, element: <ProductPage /> },
      { path: APP_ROUTES.cart, element: <CartPage /> },
      { path: APP_ROUTES.checkout, element: <CheckoutPage /> },
      { path: APP_ROUTES.checkoutResult, element: <CheckoutResultPage /> },
      { path: APP_ROUTES.login, element: <LoginPage /> },
      { path: APP_ROUTES.register, element: <RegisterPage /> },
      {
        element: <RequireAuth />,
        children: [
          { path: APP_ROUTES.favorites, element: <FavoritesPage /> },
          { path: APP_ROUTES.profile, element: <ProfilePage /> },
          { path: APP_ROUTES.orders, element: <OrdersPage /> },
          { path: APP_ROUTES.orderDetail, element: <OrderDetailPage /> },
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
