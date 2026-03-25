import { mockWmsRepository } from './mock-repository'
import { httpWmsRepository } from './http-repository'

export { httpWmsRepository } from './http-repository'
export { wmsQueryKeys } from './query-keys'
export { mockWmsRepository } from './mock-repository'

const useMockRepository =
  import.meta.env.DEV && import.meta.env.VITE_USE_WMS_MOCK === 'true'

export const wmsRepository = useMockRepository
  ? mockWmsRepository
  : httpWmsRepository
