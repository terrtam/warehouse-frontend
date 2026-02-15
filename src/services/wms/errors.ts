export type WmsErrorCode =
  | 'FORBIDDEN'
  | 'VALIDATION'
  | 'CONFLICT'
  | 'NOT_FOUND'
  | 'INSUFFICIENT_INVENTORY'

export class WmsError extends Error {
  code: WmsErrorCode
  details?: string

  constructor(code: WmsErrorCode, message: string, details?: string) {
    super(message)
    this.code = code
    this.details = details
  }
}

export const isWmsError = (value: unknown): value is WmsError =>
  value instanceof WmsError

