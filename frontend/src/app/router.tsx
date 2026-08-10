import { createBrowserRouter, type RouteObject } from 'react-router-dom'

import { RootLayout } from '@app/layouts/RootLayout'
import { CartPage } from '@pages/CartPage'
import { CheckoutPage } from '@pages/CheckoutPage'
import { CoffeePage } from '@pages/CoffeePage'
import { FavoritesPage } from '@pages/FavoritesPage'
import { HomePage } from '@pages/HomePage'
import { LoginPage } from '@pages/LoginPage'
import { MachinesPage } from '@pages/MachinesPage'
import { ProductPage } from '@pages/ProductPage'
import { RegisterPage } from '@pages/RegisterPage'

const appRoutes: RouteObject[] = [
  {
    element: <RootLayout />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/coffee', element: <CoffeePage /> },
      { path: '/machines', element: <MachinesPage /> },
      { path: '/product/:id', element: <ProductPage /> },
      { path: '/favorites', element: <FavoritesPage /> },
      { path: '/cart', element: <CartPage /> },
      { path: '/login', element: <LoginPage /> },
      { path: '/register', element: <RegisterPage /> },
      { path: '/checkout', element: <CheckoutPage /> },
    ],
  },
]

if (import.meta.env.DEV) {
  appRoutes.push({
    path: '/dev/ui-kit',
    lazy: async () => {
      const { UiKitPage } = await import('@pages/UiKitPage')
      return { Component: UiKitPage }
    },
  })
}

export const router = createBrowserRouter(appRoutes)
