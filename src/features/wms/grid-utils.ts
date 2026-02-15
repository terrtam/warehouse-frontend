import type { ColumnState } from 'ag-grid-community'

type SortDirection = 'asc' | 'desc'

export const extractSortState = (
  model: unknown
): { sortBy: string; sortDir: SortDirection } => {
  const state = Array.isArray(model) ? (model as ColumnState[]) : []
  const active = state.find((item) => item.sort)
  if (!active || !active.colId || !active.sort) {
    return { sortBy: '', sortDir: 'asc' }
  }

  return {
    sortBy: active.colId,
    sortDir: active.sort === 'desc' ? 'desc' : 'asc',
  }
}

export const sortRows = <T>(
  rows: T[],
  sortBy: string,
  sortDir: SortDirection
) => {
  if (!sortBy) return rows
  return [...rows].sort((a, b) => {
    const left = String((a as Record<string, unknown>)[sortBy] ?? '')
    const right = String((b as Record<string, unknown>)[sortBy] ?? '')
    return sortDir === 'asc'
      ? left.localeCompare(right)
      : right.localeCompare(left)
  })
}
