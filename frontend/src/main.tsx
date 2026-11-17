import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ApiError } from '@/core/api'
import { AuthProvider } from '@/core/auth'
import { applyTheme } from '@/core/theme'
import { ToastProvider } from '@/core/toast'
import { protegerContraVersaoAntiga } from '@/core/versao'
import { ConfirmProvider } from '@/components/ui'
import App from './App'
import './index.css'

applyTheme()
protegerContraVersaoAntiga()

const qc = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      refetchOnWindowFocus: false,
      retry: (n, e) => !(e instanceof ApiError && [401, 403, 404, 422].includes(e.status)) && n < 2,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={qc}>
      <ToastProvider>
        <ConfirmProvider>
          <AuthProvider><App /></AuthProvider>
        </ConfirmProvider>
      </ToastProvider>
    </QueryClientProvider>
  </StrictMode>,
)
