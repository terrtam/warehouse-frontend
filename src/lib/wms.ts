import { toast } from 'sonner'
import { isAxiosError } from 'axios'
import type { Role } from '@/domain/wms/types'
import { useAuthStore } from '@/stores/auth-store'
import { isWmsError } from '@/services/wms/errors'
import type { Actor } from '@/services/wms/repository'

const normalizeToken = (token: string): string =>
  token.startsWith('Bearer ') ? token.slice(7) : token

const decodeJwtPayload = (token: string): Record<string, unknown> | null => {
  try {
    const raw = normalizeToken(token).split('.')[1] ?? ''
    if (!raw) return null
    const normalized = raw.replace(/-/g, '+').replace(/_/g, '/')
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
    return JSON.parse(atob(padded))
  } catch {
    return null
  }
}

const toStringArray = (value: unknown): string[] => {
  if (typeof value === 'string') return [value]
  if (!Array.isArray(value)) return []
  return value
    .map((item) => {
      if (typeof item === 'string') return item
      if (!item || typeof item !== 'object') return null
      const raw = item as Record<string, unknown>
      if (typeof raw.authority === 'string') return raw.authority
      if (typeof raw.role === 'string') return raw.role
      return null
    })
    .filter((item): item is string => item !== null)
}

const extractTokenRoles = (token: string): string[] => {
  const payload = decodeJwtPayload(token)
  if (!payload) return []

  const raw = payload as Record<string, unknown>
  const roles = [
    ...toStringArray(raw.roles),
    ...toStringArray(raw.role),
    ...toStringArray(raw.authorities),
    ...toStringArray(raw.scp),
    ...toStringArray(raw.scope),
  ]

  if (roles.length > 0) {
    return roles.flatMap((role) => role.split(/\s+/)).filter((item) => !!item)
  }

  const realmAccess =
    raw.realm_access && typeof raw.realm_access === 'object'
      ? (raw.realm_access as Record<string, unknown>)
      : null
  if (realmAccess) {
    return toStringArray(realmAccess.roles)
  }

  return []
}

const toRole = (value: string): Role | null => {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/^role_/, '')
    .replace(/^role:/, '')

  if (
    normalized === 'manager' ||
    normalized === 'admin' ||
    normalized === 'administrator' ||
    normalized === 'superadmin' ||
    normalized === 'super_admin'
  ) {
    return 'manager'
  }

  if (
    normalized === 'staff' ||
    normalized === 'user' ||
    normalized === 'employee' ||
    normalized === 'operator'
  ) {
    return 'staff'
  }

  return null
}

export const getCurrentRoles = (): Role[] => {
  const state = useAuthStore.getState().auth
  const userRoles = toStringArray(state.user?.role)
  const tokenRoles = state.accessToken ? extractTokenRoles(state.accessToken) : []
  const raw = [...userRoles, ...tokenRoles]
  const parsed = raw
    .map((item) => toRole(item))
    .filter((item): item is Role => item !== null)

  if (parsed.length === 0) return ['staff']
  return Array.from(new Set(parsed))
}

export const getCurrentActor = (): Actor => {
  const user = useAuthStore.getState().auth.user
  const role = getCurrentRoles()[0]
  return {
    username: user?.username ?? 'unknown',
    role,
  }
}

export const handleWmsError = (error: unknown) => {
  if (isWmsError(error)) {
    if (error.details) {
      toast.error(`${error.message}: ${error.details}`)
      return
    }
    toast.error(error.message)
    return
  }
  if (isAxiosError(error)) {
    const payload = error.response?.data
    if (payload && typeof payload === 'object') {
      const raw = payload as Record<string, unknown>
      const message =
        typeof raw.message === 'string'
          ? raw.message
          : typeof raw.error === 'string'
            ? raw.error
            : null
      const details =
        typeof raw.details === 'string'
          ? raw.details
          : Array.isArray(raw.errors)
            ? raw.errors
                .map((item) => {
                  if (typeof item === 'string') return item
                  if (!item || typeof item !== 'object') return null
                  const field =
                    typeof (item as Record<string, unknown>).field === 'string'
                      ? (item as Record<string, unknown>).field
                      : null
                  const detailMessage =
                    typeof (item as Record<string, unknown>).message === 'string'
                      ? (item as Record<string, unknown>).message
                      : null
                  if (field && detailMessage) return `${field}: ${detailMessage}`
                  if (detailMessage) return detailMessage
                  return null
                })
                .filter((item): item is string => item !== null)
                .join(', ')
            : null

      if (message) {
        toast.error(details ? `${message}: ${details}` : message)
        return
      }
    }
    if (typeof error.message === 'string' && error.message.trim().length > 0) {
      toast.error(error.message)
      return
    }
  }
  toast.error('Unexpected error')
}
