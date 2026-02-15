import { toast } from 'sonner'
import type { Role } from '@/domain/wms/types'
import { useAuthStore } from '@/stores/auth-store'
import { isWmsError } from '@/services/wms/errors'
import type { Actor } from '@/services/wms/repository'

const toRole = (value: string): Role | null => {
  if (value === 'manager' || value === 'staff') return value
  return null
}

export const getCurrentRoles = (): Role[] => {
  const raw = useAuthStore.getState().auth.user?.role ?? []
  const parsed = raw
    .map((item) => toRole(item))
    .filter((item): item is Role => item !== null)

  if (parsed.length === 0) return ['staff']
  return parsed
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
  toast.error('Unexpected error')
}
