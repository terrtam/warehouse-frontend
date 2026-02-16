import { AxiosError, type AxiosResponse } from 'axios'
import { describe, expect, it } from 'vitest'
import { WmsError } from '@/services/wms/errors'
import { normalizeApiError } from './client'

const buildAxiosError = (status: number, data: unknown) => {
  const response = {
    status,
    statusText: 'Error',
    headers: {},
    config: {} as never,
    data,
  } as AxiosResponse

  return new AxiosError(
    'Request failed',
    'ERR_BAD_RESPONSE',
    undefined,
    undefined,
    response
  )
}

describe('normalizeApiError', () => {
  it('maps backend contract errors to WmsError', () => {
    const error = buildAxiosError(409, {
      code: 'CONFLICT',
      message: 'Version mismatch',
      details: 'Expected version does not match current version',
    })

    const normalized = normalizeApiError(error)

    expect(normalized).toBeInstanceOf(WmsError)
    expect((normalized as WmsError).code).toBe('CONFLICT')
    expect((normalized as WmsError).message).toBe('Version mismatch')
    expect((normalized as WmsError).details).toBe(
      'Expected version does not match current version'
    )
  })

  it('maps unknown backend error codes to VALIDATION', () => {
    const error = buildAxiosError(400, {
      code: 'SOMETHING_NEW',
      message: 'Bad request',
    })

    const normalized = normalizeApiError(error)

    expect(normalized).toBeInstanceOf(WmsError)
    expect((normalized as WmsError).code).toBe('VALIDATION')
  })

  it('keeps non-contract errors unchanged', () => {
    const error = buildAxiosError(500, {
      title: 'Internal Server Error',
    })

    const normalized = normalizeApiError(error)

    expect(normalized).toBe(error)
  })

  it('keeps unauthorized errors as AxiosError for global auth handling', () => {
    const error = buildAxiosError(401, {
      code: 'UNAUTHORIZED',
      message: 'Token expired',
    })

    const normalized = normalizeApiError(error)

    expect(normalized).toBe(error)
  })
})
