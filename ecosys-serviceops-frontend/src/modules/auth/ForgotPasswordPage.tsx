import { ArrowLeft, Mail } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { EcosysLogo } from '../../components/brand'
import { authService } from '../../services/authService'

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function submit() {
    if (submitting) return
    setError('')
    setMessage('')

    if (!email.trim()) {
      setError('Enter your email address to continue.')
      return
    }

    setSubmitting(true)
    try {
      const response = await authService.forgotPassword(email)
      setMessage(response.message)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'We could not submit your request right now.')
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
                subtitle="Password Assistance"
                subtitleClassName="text-[0.72rem] font-semibold normal-case tracking-[0.08em] text-[#3d5b58]"
              />
              <div className="mt-8 max-w-xl">
                <h1 className="text-3xl font-semibold tracking-[-0.03em] text-[#0C2F33] sm:text-[2.4rem]">
                  Reset access without exposing whether an account exists.
                </h1>
                <p className="mt-4 text-sm leading-7 text-[#46615f] sm:text-[0.95rem]">
                  Enter the email address linked to your Ecosys workspace and we&apos;ll send reset instructions if the account is active.
                </p>
              </div>
            </section>

            <section className="flex items-center p-2 lg:p-4">
              <div className="mx-auto w-full max-w-md">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-accent">Forgot Password</p>
                <h2 className="mt-3 text-3xl font-semibold tracking-tight text-app">Request a reset link</h2>
                <p className="mt-3 text-sm leading-6 text-muted">
                  We&apos;ll always show the same response for privacy and account security.
                </p>

                <form
                  className="mt-8 space-y-4"
                  onSubmit={(event) => {
                    event.preventDefault()
                    void submit()
                  }}
                >
                  <label className="block space-y-2">
                    <span className="text-sm font-medium text-app">Email address</span>
                    <div className="relative">
                      <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                      <input
                        type="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        className="field-input pl-11"
                        placeholder="name@example.com"
                        autoComplete="email"
                        disabled={submitting}
                      />
                    </div>
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
                    {submitting ? 'Sending reset link...' : 'Send reset link'}
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
