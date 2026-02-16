import { useState } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from '@tanstack/react-router'
import { Loader2, LogIn } from 'lucide-react'
import { toast } from 'sonner'
import { apiClient } from '@/services/api/client'
import { useAuthStore } from '@/stores/auth-store'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/password-input'

const formSchema = z.object({
  username: z
    .string()
    .min(1, 'Please enter your username')
    .min(3, 'Username must be at least 3 characters'),

  password: z
    .string()
    .min(1, 'Please enter your password')
    .min(7, 'Password must be at least 7 characters long'),
})

interface UserAuthFormProps extends React.HTMLAttributes<HTMLFormElement> {
  redirectTo?: string
}

const decodeJwtPayload = (token: string): Record<string, unknown> => {
  const payload = token.split('.')[1] ?? ''
  const normalized = payload.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
  return JSON.parse(atob(padded))
}

const toRoleStrings = (value: unknown): string[] => {
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

export function UserAuthForm({
  className,
  redirectTo,
  ...props
}: UserAuthFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const navigate = useNavigate()
  const { auth } = useAuthStore()

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      username: '',
      password: '',
    },
  })

  async function onSubmit(data: z.infer<typeof formSchema>) {
    setIsLoading(true)

    try {
      const response = await apiClient.post('/auth/login', {
        username: data.username,
        password: data.password,
      })

      const token =
        response.data &&
        typeof response.data === 'object' &&
        'token' in response.data &&
        typeof response.data.token === 'string'
          ? response.data.token
          : response.data &&
              typeof response.data === 'object' &&
              'accessToken' in response.data &&
              typeof response.data.accessToken === 'string'
            ? response.data.accessToken
          : ''
      if (!token) {
        throw new Error('Missing authentication token')
      }

      // Save token
      auth.setAccessToken(token)

      // Optional: decode JWT payload
      const payload = decodeJwtPayload(token)
      const roleCandidates = [
        ...toRoleStrings(payload.roles),
        ...toRoleStrings(payload.role),
        ...toRoleStrings(payload.authorities),
        ...toRoleStrings(payload.scp),
        ...toRoleStrings(payload.scope),
      ]
      const roles = roleCandidates
        .flatMap((value) => value.split(/\s+/))
        .filter((value) => value.length > 0)
      const normalizedRoles = roles.length > 0 ? roles : ['user']

      const user = {
        username: typeof payload.sub === 'string' ? payload.sub : data.username,
        role: normalizedRoles,
        exp:
          typeof payload.exp === 'number'
            ? payload.exp * 1000
            : Date.now() + 1000 * 60 * 60 * 8,
      }

      auth.setUser(user)

      toast.success(`Welcome back, ${user.username}!`)

      const targetPath = redirectTo || '/'
      navigate({ to: targetPath, replace: true })
    } catch (_error) {
      toast.error('Invalid username or password')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className={cn('grid gap-3', className)}
        {...props}
      >
        <FormField
          control={form.control}
          name='username'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Username</FormLabel>
              <FormControl>
                <Input placeholder='your_username' {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name='password'
          render={({ field }) => (
            <FormItem className='relative'>
              <FormLabel>Password</FormLabel>
              <FormControl>
                <PasswordInput placeholder='********' {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button className='mt-2' disabled={isLoading}>
          {isLoading ? <Loader2 className='animate-spin' /> : <LogIn />}
          Sign in
        </Button>
      </form>
    </Form>
  )
}
