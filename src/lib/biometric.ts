const BIOMETRIC_KEY = 'flowstate_biometric_v1'

export interface BiometricData {
  credentialId: string
  username: string
  refreshToken: string
}

/**
 * Converts a username to an internal email address for Supabase auth.
 * Supabase requires email format; users only ever see the username.
 */
export function usernameToEmail(username: string): string {
  const sanitized = username.toLowerCase().replace(/[^a-z0-9._-]/g, '_')
  return `${sanitized}@flowstate.local`
}

export function isBiometricSupported(): boolean {
  return !!(
    typeof window !== 'undefined' &&
    window.PublicKeyCredential &&
    navigator.credentials &&
    typeof navigator.credentials.create === 'function' &&
    typeof navigator.credentials.get === 'function'
  )
}

export function getBiometricData(): BiometricData | null {
  try {
    const raw = localStorage.getItem(BIOMETRIC_KEY)
    if (!raw) return null
    return JSON.parse(raw) as BiometricData
  } catch {
    return null
  }
}

export function clearBiometric(): void {
  localStorage.removeItem(BIOMETRIC_KEY)
}

function uint8ArrayToBase64url(bytes: Uint8Array): string {
  let binary = ''
  bytes.forEach((b) => (binary += String.fromCharCode(b)))
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function base64urlToUint8Array(str: string): Uint8Array {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=')
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

/**
 * Creates a WebAuthn platform credential on the device (triggers Face ID / Touch ID / fingerprint).
 * Stores the credential ID and the Supabase refresh token in localStorage so biometric
 * can be used to restore the session on future visits.
 */
export async function setupBiometric(username: string, refreshToken: string): Promise<boolean> {
  if (!isBiometricSupported()) return false
  try {
    const challenge = new Uint8Array(32)
    crypto.getRandomValues(challenge)

    const credential = (await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: { name: 'Flowstate', id: window.location.hostname },
        user: {
          id: new TextEncoder().encode(username),
          name: username,
          displayName: username,
        },
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 },   // ES256
          { type: 'public-key', alg: -257 },  // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'required',
          residentKey: 'preferred',
        },
        timeout: 60000,
      },
    })) as PublicKeyCredential | null

    if (!credential) return false

    const data: BiometricData = {
      credentialId: uint8ArrayToBase64url(new Uint8Array(credential.rawId)),
      username,
      refreshToken,
    }
    localStorage.setItem(BIOMETRIC_KEY, JSON.stringify(data))
    return true
  } catch {
    return false
  }
}

/**
 * Prompts biometric authentication using the stored credential.
 * Returns the stored BiometricData (including refresh token) on success, null on failure.
 */
export async function authenticateWithBiometric(): Promise<BiometricData | null> {
  const data = getBiometricData()
  if (!data) return null
  try {
    const challenge = new Uint8Array(32)
    crypto.getRandomValues(challenge)

    const credential = (await navigator.credentials.get({
      publicKey: {
        challenge,
        allowCredentials: [
          { id: base64urlToUint8Array(data.credentialId), type: 'public-key' },
        ],
        userVerification: 'required',
        timeout: 60000,
      },
    })) as PublicKeyCredential | null

    if (!credential) return null
    return data
  } catch {
    return null
  }
}
