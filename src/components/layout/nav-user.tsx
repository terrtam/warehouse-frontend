import { Link } from '@tanstack/react-router'
import {
  BadgeCheck,
  ChevronsUpDown,
  Boxes,
  LogOut,
  Tags,
} from 'lucide-react'
import useDialogState from '@/hooks/use-dialog-state'
import { useAuthStore } from '@/stores/auth-store'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'
import { SignOutDialog } from '@/components/sign-out-dialog'

type NavUserProps = {
  user: {
    name: string
    email: string
    avatar: string
  }
}

const decodeTokenRoles = (token: string): string[] => {
  if (!token) return []
  try {
    const rawToken = token.startsWith('Bearer ') ? token.slice(7) : token
    const payloadPart = rawToken.split('.')[1] ?? ''
    if (!payloadPart) return []
    const normalized = payloadPart.replace(/-/g, '+').replace(/_/g, '/')
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
    const payload = JSON.parse(atob(padded)) as Record<string, unknown>
    const candidates = [
      payload.roles,
      payload.role,
      payload.authorities,
      payload.scope,
      payload.scp,
    ]

    return candidates
      .flatMap((value) => {
        if (typeof value === 'string') return value.split(/\s+/)
        if (!Array.isArray(value)) return []
        return value.map((item) => {
          if (typeof item === 'string') return item
          if (!item || typeof item !== 'object') return ''
          const raw = item as Record<string, unknown>
          if (typeof raw.authority === 'string') return raw.authority
          if (typeof raw.role === 'string') return raw.role
          return ''
        })
      })
      .map((item) => item.trim())
      .filter((item) => item.length > 0)
  } catch {
    return []
  }
}

export function NavUser({ user }: NavUserProps) {
  const { isMobile } = useSidebar()
  const [open, setOpen] = useDialogState()
  const accessToken = useAuthStore((state) => state.auth.accessToken)
  const roles = useAuthStore((state) => state.auth.user?.role)
  const isManager = roles?.includes('manager') ?? false
  const tokenLength = accessToken.length
  const roleText = (roles ?? []).join(', ') || 'none'
  const decodedRoleText = decodeTokenRoles(accessToken).join(', ') || 'none'

  return (
    <>
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton
                size='lg'
                className='data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground'
              >
                <Avatar className='h-8 w-8 rounded-lg'>
                  <AvatarImage src={user.avatar} alt={user.name} />
                  <AvatarFallback className='rounded-lg'>SN</AvatarFallback>
                </Avatar>
                <div className='grid flex-1 text-start text-sm leading-tight'>
                  <span className='truncate font-semibold'>{user.name}</span>
                  <span className='truncate text-xs'>{user.email}</span>
                </div>
                <ChevronsUpDown className='ms-auto size-4' />
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className='w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg'
              side={isMobile ? 'bottom' : 'right'}
              align='end'
              sideOffset={4}
            >
              <DropdownMenuLabel className='p-0 font-normal'>
                <div className='flex items-center gap-2 px-1 py-1.5 text-start text-sm'>
                  <Avatar className='h-8 w-8 rounded-lg'>
                    <AvatarImage src={user.avatar} alt={user.name} />
                    <AvatarFallback className='rounded-lg'>SN</AvatarFallback>
                  </Avatar>
                  <div className='grid flex-1 text-start text-sm leading-tight'>
                    <span className='truncate font-semibold'>{user.name}</span>
                    <span className='truncate text-xs'>{user.email}</span>
                  </div>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem asChild>
                  <Link to='/products'>
                    <BadgeCheck />
                    Products
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to='/inventory'>
                    <Boxes />
                    Inventory
                  </Link>
                </DropdownMenuItem>
                {isManager && (
                  <DropdownMenuItem asChild>
                    <Link to='/categories'>
                      <Tags />
                      Categories
                    </Link>
                  </DropdownMenuItem>
                )}
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              {import.meta.env.DEV && (
                <>
                  <DropdownMenuItem disabled>{`Token length: ${tokenLength}`}</DropdownMenuItem>
                  <DropdownMenuItem disabled>{`User roles: ${roleText}`}</DropdownMenuItem>
                  <DropdownMenuItem disabled>{`JWT roles: ${decodedRoleText}`}</DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem
                variant='destructive'
                onClick={() => setOpen(true)}
              >
                <LogOut />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>

      <SignOutDialog open={!!open} onOpenChange={setOpen} />
    </>
  )
}
