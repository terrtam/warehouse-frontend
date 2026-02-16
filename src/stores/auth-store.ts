import { create } from 'zustand'
import { getCookie, setCookie, removeCookie } from '@/lib/cookies'

const ACCESS_TOKEN = 'thisisjustarandomstring'

const parseCookieToken = (value: string | undefined): string => {
  if (!value) return ''
  try {
    const parsed = JSON.parse(value)
    return typeof parsed === 'string' ? parsed : ''
  } catch {
    return ''
  }
}

const normalizeToken = (token: string): string =>
  token.startsWith('Bearer ') ? token.slice('Bearer '.length) : token

const isTokenExpired = (token: string): boolean => {
  try {
    const payloadPart = normalizeToken(token).split('.')[1] ?? ''
    if (!payloadPart) return false
    const normalized = payloadPart.replace(/-/g, '+').replace(/_/g, '/')
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
    const payload = JSON.parse(atob(padded)) as { exp?: unknown }
    if (typeof payload.exp !== 'number') return false
    return Date.now() >= payload.exp * 1000
  } catch {
    return false
  }
}

interface AuthUser {
  username: string
  role: string[]
  exp: number
}

interface AuthState {
  auth: {
    user: AuthUser | null
    setUser: (user: AuthUser | null) => void
    accessToken: string
    setAccessToken: (accessToken: string) => void
    resetAccessToken: () => void
    reset: () => void
  }
}

export const useAuthStore = create<AuthState>()((set) => {
  const cookieState = getCookie(ACCESS_TOKEN)
  const tokenFromCookie = parseCookieToken(cookieState)
  const initToken = isTokenExpired(tokenFromCookie) ? '' : tokenFromCookie
  return {
    auth: {
      user: null,
      setUser: (user) =>
        set((state) => ({ ...state, auth: { ...state.auth, user } })),
      accessToken: initToken,
      setAccessToken: (accessToken) =>
        set((state) => {
          const nextToken = normalizeToken(accessToken)
          if (!nextToken || isTokenExpired(nextToken)) {
            removeCookie(ACCESS_TOKEN)
            return { ...state, auth: { ...state.auth, accessToken: '' } }
          }
          setCookie(ACCESS_TOKEN, JSON.stringify(nextToken))
          return { ...state, auth: { ...state.auth, accessToken: nextToken } }
        }),
      resetAccessToken: () =>
        set((state) => {
          removeCookie(ACCESS_TOKEN)
          return { ...state, auth: { ...state.auth, accessToken: '' } }
        }),
      reset: () =>
        set((state) => {
          removeCookie(ACCESS_TOKEN)
          return {
            ...state,
            auth: { ...state.auth, user: null, accessToken: '' },
          }
        }),
    },
  }
})
