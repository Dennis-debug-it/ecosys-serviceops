import { ArrowRight, ShieldCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { EcosysIcon, EcosysLogo } from '../../components/brand'
import { cleanupBodyInteractivity, dispatchUiReset } from '../../utils/appCleanup'
import { roleHomePath } from '../../utils/roles'

export function LoginPage() {
  const navigate = useNavigate()
  const { login, loading } = useAuth()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [submitPhase, setSubmitPhase] = useState<'signing-in' | 'loading-workspace' | null>(null)
  const isSubmitting = submitPhase !== null

  useEffect(() => {
    cleanupBodyInteractivity()
    dispatchUiReset()
  }, [])

  function redirectToRoleHome(role: string) {
    const targetPath = roleHomePath(role)

    try {
      cleanupBodyInteractivity()
      dispatchUiReset()
      navigate(targetPath, { replace: true })
    } catch (error) {
      console.error('[auth] Failed to redirect after login.', { role, targetPath, error })
      setSubmitPhase(null)
      setError(`Signed in successfully, but we could not open your workspace automatically. Try visiting ${targetPath}.`)
    }
  }

  async function submit() {
    if (loading || isSubmitting) return
    setError('')
    setSubmitPhase('signing-in')
    cleanupBodyInteractivity()
    dispatchUiReset()

    if (!form.email.trim() || !form.password) {
      setSubmitPhase(null)
      setError('Enter your email and password to continue.')
      return
    }

    try {
      const session = await login(form, (status) => setSubmitPhase(status))
      redirectToRoleHome(String(session.role))
    } catch (error) {
      setSubmitPhase(null)
      setError(error instanceof Error ? error.message : 'Login failed.')
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-app">
      {isSubmitting ? (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-overlay/90 px-6 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-[24px] border border-app bg-[var(--app-surface)] px-8 py-10 text-center shadow-[var(--shadow-elevated)]">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-app bg-[var(--app-primary-soft)]">
              <div className="h-12 w-12 animate-spin rounded-full border-4 border-[var(--app-border-strong)] border-t-[var(--app-lime)] border-r-[var(--app-primary-strong)]" />
            </div>
            <p className="mt-6 font-heading text-lg font-semibold tracking-tight text-app">
              {submitPhase === 'loading-workspace' ? 'Loading your workspace...' : 'Signing you in...'}
            </p>
            <p className="mt-2 text-sm leading-6 text-muted">
              We&apos;re securing your session and preparing the right Ecosys workspace for you.
            </p>
          </div>
        </div>
      ) : null}
      <div className="relative mx-auto flex min-h-screen max-w-container items-center px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid w-full gap-6 lg:grid-cols-[minmax(0,0.88fr)_minmax(320px,460px)] lg:items-stretch">
          <section className="auth-showcase hidden min-h-[720px] flex-col justify-between rounded-[28px] p-8 shadow-[var(--shadow-elevated)] lg:flex">
            <EcosysLogo
              variant="light"
              size="lg"
              subtitle="ServiceOps Workspace"
              subtitleClassName="text-[0.72rem] font-semibold normal-case tracking-[0.08em] auth-showcase-muted"
            />
            <div className="space-y-6">
              <div className="max-w-xl">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#dded49]">Enterprise Control Layer</p>
                <h1 className="mt-4 font-heading text-[3rem] font-semibold leading-[1.02] tracking-[-0.05em] text-white">
                  Enterprise service operations, ready when your team is.
                </h1>
                <p className="auth-showcase-muted mt-5 max-w-lg text-base leading-7">
                  Sign in to manage workflows, teams, and customer service delivery from one Ecosys workspace.
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-[20px] border border-white/10 bg-white/5 p-5">
                  <div className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-white/10">
                    <ShieldCheck className="h-5 w-5 text-[#dded49]" />
                  </div>
                  <p className="mt-4 text-sm font-semibold text-white">Secure access</p>
                  <p className="auth-showcase-muted mt-2 text-sm leading-6">Role-aware routing and protected tenant or platform workspaces after sign-in.</p>
                </div>
                <div className="rounded-[20px] border border-white/10 bg-white/5 p-5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#dded49]">Operational Focus</p>
                  <p className="mt-4 text-2xl font-semibold text-white">Command centres, settings shells, and tenant controls in one system.</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 border-t border-white/10 pt-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-white/10 ring-1 ring-white/10">
                <EcosysIcon size={28} title="Ecosys" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-white/80">Powered by Ecosys</p>
                <p className="auth-showcase-muted text-sm">Connected tools for modern service operations.</p>
              </div>
            </div>
          </section>

          <section className="flex items-center">
            <div className="surface-card mx-auto w-full max-w-[460px] overflow-hidden !p-0">
              <div className="border-b border-app px-6 py-6 sm:px-8">
                <div className="lg:hidden">
                  <EcosysLogo
                    variant="dark"
                    size="md"
                    subtitle="ServiceOps Workspace"
                    subtitleClassName="text-[0.72rem] font-semibold normal-case tracking-[0.08em] text-muted"
                  />
                </div>
                <p className="mt-6 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--app-primary-strong)]">Login</p>
                <h2 className="mt-3 font-heading text-[2.15rem] font-semibold tracking-[-0.04em] text-app">Welcome back</h2>
                <p className="mt-3 text-sm leading-6 text-muted">Access your Ecosys workspace and continue with platform or tenant operations.</p>
              </div>

              <form
                className="space-y-5 px-6 py-6 sm:px-8"
                onSubmit={(event) => {
                  event.preventDefault()
                  void submit()
                }}
              >
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-app">Email</span>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                    className="field-input"
                    placeholder="name@company.com"
                    autoComplete="email"
                    disabled={isSubmitting}
                  />
                </label>
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-app">Password</span>
                  <input
                    type="password"
                    value={form.password}
                    onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                    className="field-input"
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    disabled={isSubmitting}
                  />
                </label>
                {error ? (
                  <div role="alert" className="rounded-[12px] border border-[var(--app-badge-danger-border)] bg-[var(--app-badge-danger-bg)] px-4 py-3 text-sm text-[var(--app-badge-danger-text)]">
                    {error}
                  </div>
                ) : null}
                <div className="flex items-center justify-end">
                  <Link to="/forgot-password" className="text-sm font-semibold text-accent-strong hover:opacity-80">
                    Forgot password?
                  </Link>
                </div>
                <button
                  type="submit"
                  className="button-primary inline-flex w-full items-center justify-center gap-2"
                  disabled={isSubmitting}
                >
                  {submitPhase === 'loading-workspace' ? 'Loading your workspace...' : isSubmitting ? 'Signing you in...' : 'Login'}
                  <ArrowRight className="h-4 w-4" />
                </button>
              </form>

              <div className="border-t border-app bg-[var(--app-surface-strong)] px-6 py-5 text-center sm:px-8">
                <p className="text-sm text-muted">
                  New to Ecosys?{' '}
                  <Link to="/get-started" className="font-semibold text-accent-strong hover:opacity-80">
                    Get Started
                  </Link>
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
