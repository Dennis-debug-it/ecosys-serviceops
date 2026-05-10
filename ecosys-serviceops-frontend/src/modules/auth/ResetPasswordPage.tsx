import { ArrowLeft, KeyRound } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { EcosysLogo } from '../../components/brand'
import { authService } from '../../services/authService'

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const token = useMemo(() => searchParams.get('token')?.trim() ?? '', [searchParams])
  const [form, setForm] = useState({ newPassword: '', confirmPassword: '' })
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function submit() {
    if (submitting) return
    setError('')
    setMessage('')

    if (!token) {
      setError('This password reset link is invalid or has expired. Please request a new one.')
      return
    }

    if (!form.newPassword || !form.confirmPassword) {
      setError('Enter and confirm your new password to continue.')
      return
    }

    if (form.newPassword !== form.confirmPassword) {
      setError('New password and confirmation password must match.')
      return
    }

    setSubmitting(true)
    try {
      const response = await authService.resetPassword({
        token,
        newPassword: form.newPassword,
        confirmPassword: form.confirmPassword,
      })
      setMessage(response.message)
      setForm({ newPassword: '', confirmPassword: '' })
    } catch (submitError) {
      const nextMessage = submitError instanceof Error ? submitError.message : 'We could not reset your password.'
      if (/invalid or has expired/i.test(nextMessage)) {
        setError('This password reset link is invalid or has expired. Please request a new one.')
      } else {
        setError(nextMessage)
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-app">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(18,122,120,0.2),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(183,226,109,0.12),transparent_32%)]" />
      <div className="relative mx-auto flex min-h-screen max-w-5xl items-center px-4 py-8 sm:px-6 lg:px-8">
        <div className="glass-panel w-full rounded-[36px] p-4 sm:p-6 lg:p-8">
          <div className="grid gap-6 lg:grid-cols-[1fr_0.94fr] lg:gap-8">
            <section className="rounded-[30px] border border-[#cfe2db] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(240,247,244,0.98))] p-6 shadow-[0_24px_60px_rgba(12,47,51,0.08)] sm:p-8">
              <EcosysLogo
                variant="dark"
                size="lg"
                subtitle="Secure Password Reset"
                subtitleClassName="text-[0.72rem] font-semibold normal-case tracking-[0.08em] text-[#3d5b58]"
              />
              <div className="mt-8 max-w-xl">
                <h1 className="text-3xl font-semibold tracking-[-0.03em] text-[#0C2F33] sm:text-[2.4rem]">
                  Choose a new password and sign back in securely.
                </h1>
                <p className="mt-4 text-sm leading-7 text-[#46615f] sm:text-[0.95rem]">
                  Reset links are single-use and expire automatically. Use a strong password with uppercase, lowercase, numbers, and symbols.
                </p>
              </div>
            </section>

            <section className="flex items-center p-2 lg:p-4">
              <div className="mx-auto w-full max-w-md">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-accent">Reset Password</p>
                <h2 className="mt-3 text-3xl font-semibold tracking-tight text-app">Set a new password</h2>
                <p className="mt-3 text-sm leading-6 text-muted">
                  Your new password will replace the current one immediately after a valid reset.
                </p>

                <form
                  className="mt-8 space-y-4"
                  onSubmit={(event) => {
                    event.preventDefault()
                    void submit()
                  }}
                >
                  <label className="block space-y-2">
                    <span className="text-sm font-medium text-app">New password</span>
                    <div className="relative">
                      <KeyRound className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                      <input
                        type="password"
                        value={form.newPassword}
                        onChange={(event) => setForm((current) => ({ ...current, newPassword: event.target.value }))}
                        className="field-input pl-11"
                        placeholder="Enter a strong password"
                        autoComplete="new-password"
                        disabled={submitting}
                      />
                    </div>
                  </label>

                  <label className="block space-y-2">
                    <span className="text-sm font-medium text-app">Confirm password</span>
                    <input
                      type="password"
                      value={form.confirmPassword}
                      onChange={(event) => setForm((current) => ({ ...current, confirmPassword: event.target.value }))}
                      className="field-input"
                      placeholder="Re-enter your new password"
                      autoComplete="new-password"
                      disabled={submitting}
                    />
                  </label>

                  {message ? (
                    <div role="status" className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700">
                      {message}
                    </div>
                  ) : null}

                  {error ? (
                    <div role="alert" className="rounded-2xl border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-700">
                      {error}
                    </div>
                  ) : null}

                  <button
                    type="submit"
                    className="inline-flex w-full items-center justify-center rounded-2xl bg-[#127A78] px-4 py-3 text-sm font-semibold text-white shadow-[0_16px_34px_rgba(18,122,120,0.28)] transition hover:bg-[#0C2F33] disabled:cursor-not-allowed disabled:opacity-70"
                    disabled={submitting}
                  >
                    {submitting ? 'Resetting password...' : 'Reset password'}
                  </button>
                </form>

                <Link to="/login" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-accent-strong hover:opacity-80">
                  <ArrowLeft className="h-4 w-4" />
                  Back to login
                </Link>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}
