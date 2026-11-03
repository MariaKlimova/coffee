import { createBrowserRouter, Navigate, type RouteObject } from 'react-router-dom'

import { RootLayout } from '@app/layouts/RootLayout'
import { ManageLayout } from '@app/layouts/ManageLayout'
import { RequireAuth } from '@app/routes/RequireAuth'
import { RequireStaff } from '@app/routes/RequireStaff'
import { RequireCustomer } from '@app/routes/RequireCustomer'
import { CartPage } from '@pages/CartPage'
import { CheckoutPage } from '@pages/CheckoutPage'
import { CheckoutResultPage } from '@pages/CheckoutResultPage'
import { CoffeePage } from '@pages/CoffeePage'
import { FavoritesPage } from '@pages/FavoritesPage'
import { LoginPage } from '@pages/LoginPage'
import { MachinesPage } from '@pages/MachinesPage'
import { ManagePage } from '@pages/ManagePage'
import { OrderDetailPage } from '@pages/OrderDetailPage'
import { OrdersPage } from '@pages/OrdersPage'
import { ProductPage } from '@pages/ProductPage'
import { ProfilePage } from '@pages/ProfilePage'
import { RegisterPage } from '@pages/RegisterPage'
import { APP_ROUTES } from '@shared/config'

const appRoutes: RouteObject[] = [
  {
    element: <RequireStaff />,
    children: [
      {
        element: <ManageLayout />,
        children: [
          { path: APP_ROUTES.manage, element: <ManagePage /> },
          {
            path: APP_ROUTES.manageProducts,
            lazy: async () => {
              const { ManageProductsPage } = await import('@pages/ManageProductsPage')
              return { Component: ManageProductsPage }
            },
          },
          {
            path: APP_ROUTES.manageProductNew,
            lazy: async () => {
              const { ManageProductCreatePage } =
                await import('@pages/ManageProductCreatePage')
              return { Component: ManageProductCreatePage }
            },
          },
          {
            path: APP_ROUTES.manageProductEdit,
            lazy: async () => {
              const { ManageProductEditPage } =
                await import('@pages/ManageProductEditPage')
              return { Component: ManageProductEditPage }
            },
          },
        ],
      },
    ],
  },
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
      { path: APP_ROUTES.login, element: <LoginPage /> },
      { path: APP_ROUTES.register, element: <RegisterPage /> },
      {
        element: <RequireCustomer />,
        children: [
          { path: APP_ROUTES.cart, element: <CartPage /> },
          { path: APP_ROUTES.checkout, element: <CheckoutPage /> },
          { path: APP_ROUTES.checkoutResult, element: <CheckoutResultPage /> },
          {
            element: <RequireAuth />,
            children: [
              { path: APP_ROUTES.favorites, element: <FavoritesPage /> },
              { path: APP_ROUTES.orders, element: <OrdersPage /> },
              { path: APP_ROUTES.orderDetail, element: <OrderDetailPage /> },
            ],
          },
        ],
      },
      {
        element: <RequireAuth />,
        children: [{ path: APP_ROUTES.profile, element: <ProfilePage /> }],
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
