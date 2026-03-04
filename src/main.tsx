import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useNetworkStore } from './stores/networkStore'
import App from './App.tsx'

const queryClient = new QueryClient()

function setOnline() {
  useNetworkStore.getState().setOnline(true)
}
function setOffline() {
  useNetworkStore.getState().setOnline(false)
}
if (typeof window !== 'undefined') {
  window.addEventListener('online', setOnline)
  window.addEventListener('offline', setOffline)
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
)
