import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import type { Session } from '@supabase/supabase-js'
import './index.css'

function LoginScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage(null)
    const { error } = await supabase.auth.signUp({ email, password })
    setLoading(false)
    if (error) setMessage(error.message)
    else setMessage('Check your email for the confirmation link.')
  }

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) setMessage(error.message)
  }

  return (
    <div style={{ padding: 24, maxWidth: 360, margin: '40px auto' }}>
      <h1 style={{ marginTop: 0 }}>Flowstate</h1>
      <p style={{ color: '#666', marginBottom: 24 }}>Sign in or create an account.</p>
      <form onSubmit={handleSignIn}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={{ display: 'block', width: '100%', marginBottom: 8, padding: 8 }}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={{ display: 'block', width: '100%', marginBottom: 16, padding: 8 }}
        />
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="submit" disabled={loading} style={{ padding: '8px 16px' }}>
            Sign in
          </button>
          <button type="button" onClick={handleSignUp} disabled={loading} style={{ padding: '8px 16px' }}>
            Sign up
          </button>
        </div>
      </form>
      {message && <p style={{ marginTop: 16, color: '#666' }}>{message}</p>}
    </div>
  )
}

function AppShell() {
  return (
    <div style={{ padding: 24 }}>
      <h1>Flowstate</h1>
      <p>You are logged in. App shell placeholder.</p>
    </div>
  )
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const code = urlParams.get('code')
    const next = urlParams.get('next') ?? '/'

    const init = async () => {
      if (code) {
        await supabase.auth.exchangeCodeForSession(code)
        window.history.replaceState({}, '', next)
      }
      const { data: { session: s } } = await supabase.auth.getSession()
      setSession(s)
      setLoading(false)
    }

    init()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
    })

    return () => subscription.unsubscribe()
  }, [])

  if (loading) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <p>Loading…</p>
      </div>
    )
  }

  if (!session) {
    return <LoginScreen />
  }

  return <AppShell />
}
