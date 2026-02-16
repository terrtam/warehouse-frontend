import axios, { AxiosError, AxiosHeaders } from 'axios'
import type { AxiosInstance } from 'axios'
import { useAuthStore } from '@/stores/auth-store'
import { WmsError, type WmsErrorCode } from '@/services/wms/errors'

type BackendErrorPayload = {
  code?: unknown
  message?: unknown
  details?: unknown
}

const codeMap: Record<string, WmsErrorCode> = {
  CONFLICT: 'CONFLICT',
  FORBIDDEN: 'FORBIDDEN',
  INSUFFICIENT_INVENTORY: 'INSUFFICIENT_INVENTORY',
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION: 'VALIDATION',
}

const isBackendErrorPayload = (value: unknown): value is BackendErrorPayload =>
  typeof value === 'object' && value !== null

const mapErrorCode = (rawCode: unknown): WmsErrorCode => {
  if (typeof rawCode !== 'string') return 'VALIDATION'
  return codeMap[rawCode.toUpperCase()] ?? 'VALIDATION'
}

const getAuthHeader = () => {
  const token = useAuthStore.getState().auth.accessToken
  if (!token) return null
  return token.startsWith('Bearer ') ? token : `Bearer ${token}`
}

export const normalizeApiError = (error: unknown): unknown => {
  if (!(error instanceof AxiosError)) return error
  if ([401, 403].includes(error.response?.status ?? 0)) return error

  const payload = error.response?.data
  if (!isBackendErrorPayload(payload)) return error
  if (typeof payload.message !== 'string') return error

  const details =
    typeof payload.details === 'string' ? payload.details : undefined

  return new WmsError(mapErrorCode(payload.code), payload.message, details)
}

export const createApiClient = (): AxiosInstance => {
  const baseURL =
    import.meta.env.VITE_API_URL?.trim() ||
    import.meta.env.VITE_API_BASE_URL?.trim() ||
    'http://localhost:8080'

  const client = axios.create({
    baseURL,
  })

  client.interceptors.request.use((config) => {
    const authHeader = getAuthHeader()
    if (import.meta.env.DEV) {
      const tokenLength = useAuthStore.getState().auth.accessToken.length
      // eslint-disable-next-line no-console
      console.debug('[api] request', {
        method: config.method,
        url: config.url,
        hasAuthorization: Boolean(authHeader),
        tokenLength,
      })
    }
    if (!authHeader) return config

    if (typeof config.headers?.set === 'function') {
      config.headers.set('Authorization', authHeader)
    } else {
      const headers = AxiosHeaders.from(config.headers)
      headers.set('Authorization', authHeader)
      config.headers = headers
    }

    return config
  })

  client.interceptors.response.use(
    (response) => response,
    (error: unknown) => Promise.reject(normalizeApiError(error))
  )

  return client
}

export const apiClient = createApiClient()
