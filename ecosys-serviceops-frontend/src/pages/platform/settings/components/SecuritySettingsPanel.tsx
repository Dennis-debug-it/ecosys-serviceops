import { useEffect, useState } from 'react'
import { InfoAlert } from '../../../../components/ui/InfoAlert'
import { LoadingState } from '../../../../components/ui/LoadingState'
import { useToast } from '../../../../components/ui/ToastProvider'
import { useAsyncData } from '../../../../hooks/useAsyncData'
import { platformSettingsService, type PlatformSecuritySettings } from '../../../../services/platformSettingsService'
import { toServiceError } from '../../../../services/platformService'
import { Field, SectionTitle } from '../../../../modules/platform-v2/PlatformCommon'

export function SecuritySettingsPanel() {
  const { pushToast } = useToast()
  const { data, loading, error, reload } = useAsyncData(() => platformSettingsService.getSecurity(), {
    requireStrongPasswords: true,
    minimumPasswordLength: 10,
    requireEmailVerification: true,
    sessionTimeoutMinutes: 60,
    failedLoginLockoutThreshold: 5,
    twoFactorAuthImplemented: false,
    passwordResetExpiryMinutes: 30,
  }, [])
  const [form, setForm] = useState<PlatformSecuritySettings>(data)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setForm(data)
  }, [data])

  async function save() {
    setSaving(true)
    try {
      await platformSettingsService.updateSecurity(form)
      pushToast({ title: 'Security settings saved', description: 'Security policy settings were updated.', tone: 'success' })
      await reload()
    } catch (saveError) {
      pushToast({ title: 'Save failed', description: toServiceError(saveError, 'Unable to save security settings.'), tone: 'danger' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <LoadingState label="Loading security settings" />
  if (error) return <InfoAlert title="Unable to load security settings" description={error} tone="danger" />

  return (
    <section className="surface-card space-y-4">
      <SectionTitle title="Security Settings" description="Password strength, lockout behavior, and session controls." />
      <InfoAlert title="Email verification and self-service reset status" description="Policy settings are available here, but public email verification links and self-service forgot-password reset screens are not exposed yet. Until those flows are implemented, workspace users should contact an administrator for password assistance." tone="warning" />
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Minimum Password Length"><input type="number" min={8} value={form.minimumPasswordLength} onChange={(event) => setForm((current) => ({ ...current, minimumPasswordLength: Number(event.target.value) || 8 }))} className="field-input" /></Field>
        <Field label="Session Timeout (Minutes)"><input type="number" min={5} value={form.sessionTimeoutMinutes} onChange={(event) => setForm((current) => ({ ...current, sessionTimeoutMinutes: Number(event.target.value) || 5 }))} className="field-input" /></Field>
        <Field label="Failed Login Lockout Threshold"><input type="number" min={3} value={form.failedLoginLockoutThreshold} onChange={(event) => setForm((current) => ({ ...current, failedLoginLockoutThreshold: Number(event.target.value) || 3 }))} className="field-input" /></Field>
        <Field label="Password Reset Expiry (Minutes)"><input type="number" min={5} value={form.passwordResetExpiryMinutes} onChange={(event) => setForm((current) => ({ ...current, passwordResetExpiryMinutes: Number(event.target.value) || 5 }))} className="field-input" /></Field>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <label className="panel-subtle flex items-center justify-between rounded-2xl px-4 py-3"><span className="text-sm text-app">Require strong passwords</span><input type="checkbox" checked={form.requireStrongPasswords} onChange={(event) => setForm((current) => ({ ...current, requireStrongPasswords: event.target.checked }))} /></label>
        <label className="panel-subtle flex items-center justify-between rounded-2xl px-4 py-3"><span className="text-sm text-app">Require email verification</span><input type="checkbox" checked={form.requireEmailVerification} onChange={(event) => setForm((current) => ({ ...current, requireEmailVerification: event.target.checked }))} /></label>
        <div className="panel-subtle rounded-2xl px-4 py-3">
          <p className="text-sm text-app">Two-Factor Authentication</p>
          <p className="mt-1 text-xs text-muted">{form.twoFactorAuthImplemented ? 'Enabled' : 'Not enabled'}</p>
        </div>
      </div>
      <div className="flex justify-end">
        <button type="button" className="button-primary" onClick={() => void save()} disabled={saving}>{saving ? 'Saving...' : 'Save Security Settings'}</button>
      </div>
    </section>
  )
}
