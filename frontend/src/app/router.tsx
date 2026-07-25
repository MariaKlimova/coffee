import { createBrowserRouter } from 'react-router-dom'

import { CartPage } from '@pages/CartPage'
import { CheckoutPage } from '@pages/CheckoutPage'
import { CoffeePage } from '@pages/CoffeePage'
import { FavoritesPage } from '@pages/FavoritesPage'
import { HomePage } from '@pages/HomePage'
import { LoginPage } from '@pages/LoginPage'
import { MachinesPage } from '@pages/MachinesPage'
import { ProductPage } from '@pages/ProductPage'
import { RegisterPage } from '@pages/RegisterPage'

export const router = createBrowserRouter([
  { path: '/', element: <HomePage /> },
  { path: '/coffee', element: <CoffeePage /> },
  { path: '/machines', element: <MachinesPage /> },
  { path: '/product/:id', element: <ProductPage /> },
  { path: '/favorites', element: <FavoritesPage /> },
  { path: '/cart', element: <CartPage /> },
  { path: '/login', element: <LoginPage /> },
  { path: '/register', element: <RegisterPage /> },
  { path: '/checkout', element: <CheckoutPage /> },
])
