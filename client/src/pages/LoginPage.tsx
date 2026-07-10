import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate, Navigate } from 'react-router-dom'
import { authClient } from '../lib/auth-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'

const schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
})

type FormValues = z.infer<typeof schema>

export default function LoginPage() {
  const navigate = useNavigate()
  const { data: session, isPending: sessionPending } = authClient.useSession()

  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { email: '', password: '' } })
  const { setError, formState: { isSubmitting } } = form

  if (sessionPending) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading…</p>
      </div>
    )
  }

  if (session) {
    return <Navigate to="/" replace />
  }

  async function onSubmit(values: FormValues) {
    const { error } = await authClient.signIn.email(values)
    if (error) {
      setError('root', { message: error.message ?? 'Invalid email or password' })
      return
    }
    navigate('/')
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center px-4 overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(60% 50% at 50% 20%, color-mix(in srgb, #f97316 18%, transparent), transparent)',
        }}
        aria-hidden
      />
      <div className="relative w-full max-w-sm space-y-6">
        <div className="flex items-center gap-2 justify-center">
          <span className="size-2 rounded-[2px] bg-orange-500" aria-hidden />
          <span className="font-display font-semibold tracking-tight text-sm text-muted-foreground">
            TicketDesk
          </span>
        </div>
        <Card className="border-orange-500/20 shadow-xl shadow-orange-950/40">
          <CardHeader>
            <CardTitle className="font-display text-2xl font-semibold tracking-tight">Sign in</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input
                          type="text"
                          autoComplete="email"
                          inputMode="email"
                          className="border-orange-500/20 focus-visible:border-orange-500 focus-visible:ring-orange-500"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          autoComplete="current-password"
                          className="border-orange-500/20 focus-visible:border-orange-500 focus-visible:ring-orange-500"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {form.formState.errors.root && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.root.message}
                  </p>
                )}

                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-orange-500 text-white hover:bg-orange-600 focus-visible:ring-orange-500"
                >
                  {isSubmitting ? 'Signing in…' : 'Sign in'}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
