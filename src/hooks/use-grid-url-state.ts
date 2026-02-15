import { useMemo } from 'react'

type SearchRecord = Record<string, unknown>

type SortDirection = 'asc' | 'desc'

export type NavigateFn = (opts: {
  search: true | SearchRecord | ((prev: SearchRecord) => Partial<SearchRecord> | SearchRecord)
  replace?: boolean
}) => void

type GridUrlStateParams = {
  search: SearchRecord
  navigate: NavigateFn | ((opts: unknown) => void)
  defaults?: {
    page?: number
    pageSize?: number
    q?: string
    sortBy?: string
    sortDir?: SortDirection
  }
}

export const useGridUrlState = ({
  search,
  navigate,
  defaults = {},
}: GridUrlStateParams) => {
  const navigateAny = navigate as (opts: {
    search: true | SearchRecord | ((prev: SearchRecord) => Partial<SearchRecord> | SearchRecord)
    replace?: boolean
  }) => void

  const pageDefault = defaults.page ?? 1
  const pageSizeDefault = defaults.pageSize ?? 10
  const qDefault = defaults.q ?? ''
  const sortByDefault = defaults.sortBy ?? ''
  const sortDirDefault = defaults.sortDir ?? 'asc'

  const pagination = useMemo(
    () => ({
      page: typeof search.page === 'number' ? search.page : pageDefault,
      pageSize: typeof search.pageSize === 'number' ? search.pageSize : pageSizeDefault,
    }),
    [search.page, search.pageSize, pageDefault, pageSizeDefault]
  )

  const q = typeof search.q === 'string' ? search.q : qDefault
  const sortBy = typeof search.sortBy === 'string' ? search.sortBy : sortByDefault
  const sortDir =
    search.sortDir === 'asc' || search.sortDir === 'desc'
      ? search.sortDir
      : sortDirDefault

  const setPagination = (next: { page: number; pageSize: number }) => {
    navigateAny({
      search: (prev) => ({
        ...prev,
        page: next.page === pageDefault ? undefined : next.page,
        pageSize: next.pageSize === pageSizeDefault ? undefined : next.pageSize,
      }),
    })
  }

  const setQuery = (next: string) => {
    navigateAny({
      search: (prev) => ({
        ...prev,
        page: undefined,
        q: next.trim() === qDefault ? undefined : next.trim(),
      }),
    })
  }

  const setSort = (nextSortBy: string, nextSortDir: SortDirection) => {
    navigateAny({
      search: (prev) => ({
        ...prev,
        sortBy: nextSortBy === sortByDefault ? undefined : nextSortBy,
        sortDir: nextSortDir === sortDirDefault ? undefined : nextSortDir,
      }),
    })
  }

  return {
    pagination,
    setPagination,
    q,
    setQuery,
    sortBy,
    sortDir,
    setSort,
  }
}
