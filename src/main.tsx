import { StrictMode, Component, type ReactNode } from 'react'
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
  if (!import.meta.env.DEV && 'serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  }
}

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 24, fontFamily: 'system-ui', maxWidth: 600 }}>
          <h1 style={{ color: '#c62828' }}>Something went wrong</h1>
          <pre style={{ overflow: 'auto', background: '#f5f5f5', padding: 16, borderRadius: 8 }}>
            {this.state.error.message}
          </pre>
          <p style={{ color: '#666' }}>Check the browser console for more details.</p>
        </div>
      )
    }
    return this.props.children
  }
}

const rootEl = document.getElementById('root')
if (!rootEl) {
  document.body.innerHTML = '<div style="padding:24px;font-family:system-ui">Root element #root not found.</div>'
} else {
  createRoot(rootEl).render(
    <StrictMode>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </ErrorBoundary>
    </StrictMode>,
  )
}
