import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { App } from '@app/App'
import { setupAuthBridge } from '@app/lib/setupAuthBridge'
import { AppProviders } from '@app/providers/AppProviders'
import { bindCartBridge } from '@entities/cart'
import '@shared/ui/tokens.css'

setupAuthBridge()
bindCartBridge()

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('Root element #root not found')
}

createRoot(rootElement).render(
  <StrictMode>
    <AppProviders>
      <App />
    </AppProviders>
  </StrictMode>,
)
