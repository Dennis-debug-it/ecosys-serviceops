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
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(18,122,120,0.2),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(183,226,109,0.12),transparent_32%)]" />
      {isSubmitting ? (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#062b31]/58 px-6 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-[28px] border border-white/12 bg-[linear-gradient(180deg,rgba(7,42,48,0.96),rgba(8,58,63,0.94))] px-8 py-10 text-center shadow-[0_24px_80px_rgba(1,16,20,0.35)]">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-[#7ee787]/18 bg-[radial-gradient(circle_at_30%_30%,rgba(163,230,53,0.28),rgba(18,122,120,0.08)_55%,transparent_72%)]">
              <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#1e5b61] border-t-[#a3e635] border-r-[#2dd4bf]" />
            </div>
            <p className="mt-6 text-lg font-semibold tracking-tight text-white">
              {submitPhase === 'loading-workspace' ? 'Loading your workspace...' : 'Signing you in...'}
            </p>
            <p className="mt-2 text-sm leading-6 text-[#b9d4d1]">
              We&apos;re securing your session and preparing the right Ecosys workspace for you.
            </p>
          </div>
        </div>
      ) : null}
      <div className="relative mx-auto flex min-h-screen max-w-6xl items-center px-4 py-8 sm:px-6 lg:px-8">
        <div className="glass-panel grid w-full gap-6 rounded-[36px] p-4 sm:p-6 lg:grid-cols-[1.02fr_0.98fr] lg:gap-8 lg:p-8">
          <section className="rounded-[30px] border border-[#cfe2db] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(240,247,244,0.98))] p-6 shadow-[0_24px_60px_rgba(12,47,51,0.08)] sm:p-8">
            <EcosysLogo
              variant="dark"
              size="lg"
              subtitle="ServiceOps Workspace"
              subtitleClassName="text-[0.72rem] font-semibold normal-case tracking-[0.08em] text-[#3d5b58]"
              imageClassName="drop-shadow-[0_6px_18px_rgba(12,47,51,0.08)]"
            />
            <div className="mt-8 max-w-xl">
              <h1 className="text-3xl font-semibold tracking-[-0.03em] text-[#0C2F33] sm:text-[2.6rem]">
                Enterprise service operations, ready when your team is.
              </h1>
              <p className="mt-4 text-sm leading-7 text-[#46615f] sm:text-[0.95rem]">
                Sign in to manage workflows, teams, and customer service delivery from one Ecosys workspace.
              </p>
            </div>
            <div className="mt-8 rounded-[24px] border border-[#d5e4de] bg-white/72 p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#e7f3ef]">
                  <ShieldCheck className="h-4 w-4 text-[#127A78]" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#0C2F33]">Secure access</p>
                  <p className="text-sm text-[#56706d]">Use your Ecosys email and password to continue.</p>
                </div>
              </div>
            </div>
            <div className="mt-10 flex items-center gap-3 border-t border-[#d7e5df] pt-5">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#edf7f2] ring-1 ring-[#d7e8df]">
                <EcosysIcon size={28} title="Ecosys" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#4e6a67]">Powered by Ecosys</p>
                <p className="text-sm text-[#66807d]">Connected tools for modern service operations.</p>
              </div>
            </div>
          </section>

          <section className="flex items-center p-2 lg:p-4">
            <div className="mx-auto w-full max-w-md">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-accent">Login</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-app">Welcome back</h2>
              <p className="mt-3 text-sm leading-6 text-muted">Sign in to continue to your Ecosys workspace.</p>

              <form
                className="mt-8 space-y-4"
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
                  <div role="alert" className="rounded-2xl border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-700 dark:text-rose-200">
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
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#127A78] px-4 py-3 text-sm font-semibold text-white shadow-[0_16px_34px_rgba(18,122,120,0.28)] transition hover:bg-[#0C2F33] disabled:cursor-not-allowed disabled:opacity-70"
                  disabled={isSubmitting}
                >
                  {submitPhase === 'loading-workspace' ? 'Loading your workspace...' : isSubmitting ? 'Signing you in...' : 'Login'}
                  <ArrowRight className="h-4 w-4" />
                </button>
              </form>

              <p className="mt-6 text-sm text-muted">
                New to Ecosys?{' '}
                <Link to="/get-started" className="font-semibold text-accent-strong hover:opacity-80">
                  Get Started
                </Link>
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
