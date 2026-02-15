import z from 'zod'

export const wmsGridSearchSchema = z.object({
  page: z.number().optional().catch(1),
  pageSize: z.number().optional().catch(10),
  q: z.string().optional().catch(''),
  sortBy: z.string().optional().catch(''),
  sortDir: z.union([z.literal('asc'), z.literal('desc')]).optional().catch('asc'),
})

