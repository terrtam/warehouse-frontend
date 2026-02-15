import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

type GridToolbarProps = {
  query: string
  onQueryChange: (value: string) => void
  placeholder: string
}

export function GridToolbar({ query, onQueryChange, placeholder }: GridToolbarProps) {
  return (
    <div className='flex items-center gap-2'>
      <Input
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        placeholder={placeholder}
        className='max-w-sm'
      />
      <Button
        variant='outline'
        onClick={() => {
          onQueryChange('')
        }}
      >
        Clear
      </Button>
    </div>
  )
}

