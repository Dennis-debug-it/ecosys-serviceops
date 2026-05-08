import { useEffect, useState } from 'react'
import { InfoAlert } from '../../../../components/ui/InfoAlert'
import { LoadingState } from '../../../../components/ui/LoadingState'
import { useToast } from '../../../../components/ui/ToastProvider'
import { useAsyncData } from '../../../../hooks/useAsyncData'
import { platformSettingsService, type PlatformEmailSettings, type PlatformNotificationPreference } from '../../../../services/platformSettingsService'
import { toServiceError } from '../../../../services/platformService'
import { Field, SectionTitle } from '../../../../modules/platform-v2/PlatformCommon'

const preferenceLabels: Record<string, string> = {
  'new-tenant-created': 'New tenant created',
  'tenant-deactivated': 'Tenant deactivated',
  'subscription-expiring': 'Subscription expiring',
  'invoice-overdue': 'Account attention needed',
  'payment-received': 'Payment confirmation received',
  'work-order-overdue': 'Work order overdue',
  'sla-breach': 'Priority response alert',
  'failed-login-attempts': 'Failed login attempts',
  'system-errors': 'System errors',
}

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const defaultSettings: PlatformEmailSettings = {
  deliveryMode: 'Smtp',
  smtpHost: '',
  smtpPort: 587,
  smtpUsername: '',
  smtpPasswordMasked: '',
  smtpPasswordSecret: '',
  senderName: 'Ecosys Platform',
  senderEmail: '',
  replyToEmail: '',
  enableSslTls: true,
  secureMode: 'Auto',
  apiEndpoint: '',
  apiKeyMasked: '',
  apiKeySecret: '',
  apiProviderName: '',
  timeoutSeconds: 30,
  maxRetries: 0,
  enableEmailNotifications: true,
  enableSystemAlerts: true,
  enableInvoiceEmails: true,
  enableQuotationEmails: true,
  enablePaymentReceiptEmails: true,
  enableWorkOrderNotificationEmails: true,
  enableSlaEscalationEmails: true,
  enableTenantOnboardingEmails: true,
  notificationPreferences: Object.keys(preferenceLabels).map((key) => ({
    notificationKey: key,
    emailEnabled: true,
    inAppEnabled: key === 'failed-login-attempts' || key === 'system-errors',
    smsEnabled: false,
    isActive: true,
  })),
  lastError: null,
  lastTestedAt: null,
}

export function EmailNotificationSettingsPanel() {
  const { pushToast } = useToast()
  const { data, loading, error, reload } = useAsyncData(() => platformSettingsService.getEmail(), defaultSettings, [])
  const [form, setForm] = useState<PlatformEmailSettings>(data)
  const [testEmail, setTestEmail] = useState('')
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [verifying, setVerifying] = useState(false)

  useEffect(() => {
    setForm({ ...data, smtpPasswordSecret: '', apiKeySecret: '' })
  }, [data])

  function validate(): string | null {
    if (form.enableEmailNotifications && form.deliveryMode === 'Smtp') {
      if (!form.smtpHost.trim()) {
        return 'SMTP host is required when email notifications are enabled.'
      }
      if (!Number.isFinite(form.smtpPort) || form.smtpPort <= 0) {
        return 'SMTP port must be a positive number.'
      }
      if (!form.senderEmail.trim()) {
        return 'Sender email is required when email notifications are enabled.'
      }
      if (!emailRegex.test(form.senderEmail.trim())) {
        return 'Sender email must be a valid email address.'
      }
    }

    if (form.enableEmailNotifications && form.deliveryMode === 'Api') {
      if (!form.apiEndpoint.trim()) {
        return 'A delivery endpoint is required when alternative email delivery is enabled.'
      }
    }

    if (form.replyToEmail && !emailRegex.test(form.replyToEmail.trim())) {
      return 'Reply-to email must be a valid email address.'
    }

    return null
  }

  async function save() {
    const validationError = validate()
    if (validationError) {
      pushToast({ title: 'Validation failed', description: validationError, tone: 'warning' })
      return
    }

    setSaving(true)
    try {
      await platformSettingsService.updateEmail(form)
      pushToast({ title: 'Email settings saved', description: 'Delivery and notification settings were updated.', tone: 'success' })
      await reload()
    } catch (saveError) {
      pushToast({ title: 'Save failed', description: toServiceError(saveError, 'Unable to save email settings.'), tone: 'danger' })
    } finally {
      setSaving(false)
    }
  }

  async function sendTest() {
    const validationError = validate()
    if (validationError) {
      pushToast({ title: 'Validation failed', description: validationError, tone: 'warning' })
      return
    }

    setTesting(true)
    try {
      const response = await platformSettingsService.sendTestEmail(testEmail || undefined)
      pushToast({
        title: response.success ? 'Test email sent' : 'Test email failed',
        description: response.success ? 'Test email was sent successfully.' : response.lastError || 'Unable to send test email.',
        tone: response.success ? 'success' : 'danger',
      })
      await reload()
    } catch (testError) {
      pushToast({ title: 'Test failed', description: toServiceError(testError, 'Unable to send test email.'), tone: 'danger' })
    } finally {
      setTesting(false)
    }
  }

  async function verify() {
    const validationError = validate()
    if (validationError) {
      pushToast({ title: 'Validation failed', description: validationError, tone: 'warning' })
      return
    }

    setVerifying(true)
    try {
      const response = await platformSettingsService.verifySmtpConnection()
      pushToast({
        title: response.success ? 'Connection verified' : 'Connection verification failed',
        description: response.success ? 'Delivery connection verified successfully.' : response.lastError || 'Unable to verify delivery connection.',
        tone: response.success ? 'success' : 'danger',
      })
      await reload()
    } catch (verifyError) {
      pushToast({ title: 'Verification failed', description: toServiceError(verifyError, 'Unable to verify delivery connection.'), tone: 'danger' })
    } finally {
      setVerifying(false)
    }
  }

  function updatePreference(key: string, update: Partial<PlatformNotificationPreference>) {
    setForm((current) => ({
      ...current,
      notificationPreferences: current.notificationPreferences.map((item) => (item.notificationKey === key ? { ...item, ...update } : item)),
    }))
  }

  if (loading) return <LoadingState label="Loading email and notification settings" />
  if (error) return <InfoAlert title="Unable to load email settings" description={error} tone="danger" />
  const smtpMode = form.deliveryMode === 'Smtp'
  const apiMode = form.deliveryMode === 'Api'
  const disabledMode = form.deliveryMode === 'Disabled'

  return (
    <section data-testid="platform-email-settings-form" className="surface-card space-y-4">
      <SectionTitle title="Email & Notifications Settings" description="Manage email delivery and alert preferences for platform activity." />
      <InfoAlert title="SMTP sends mail only" description="Outbound SMTP covers test emails, user credentials, resend credentials, onboarding, lead notifications, and template test sends. Email intake for creating or updating work orders is a separate IMAP workflow and must be configured independently." tone="info" />
      <InfoAlert title="Notification rollout status" description="Platform lead notifications, user credential delivery, resend credentials, tenant onboarding, and SMTP test delivery are live. Work order, PM, material, license, SMTP failure, and security alert toggles are available for configuration, but some automated dispatch hooks are still pending and should not be treated as fully active until workflow jobs are added." tone="warning" />
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Delivery Method">
          <select value={form.deliveryMode} onChange={(event) => setForm((current) => ({ ...current, deliveryMode: event.target.value as PlatformEmailSettings['deliveryMode'] }))} className="field-input">
            <option value="Smtp">SMTP</option>
            <option value="Api">Alternative Delivery</option>
            <option value="Disabled">Disabled</option>
          </select>
        </Field>
        <Field label="Secure Mode">
          <select value={form.secureMode} onChange={(event) => setForm((current) => ({ ...current, secureMode: event.target.value as PlatformEmailSettings['secureMode'] }))} className="field-input">
            <option value="Auto">Auto</option>
            <option value="None">None</option>
            <option value="StartTls">STARTTLS</option>
            <option value="SslOnConnect">SSL on Connect</option>
          </select>
          <p className="text-xs text-muted">Port 465 uses SSL/TLS. Port 587 uses STARTTLS.</p>
        </Field>
        <Field label="SMTP Host"><input data-testid="smtp-host-input" disabled={!smtpMode || disabledMode} value={form.smtpHost || ''} onChange={(event) => setForm((current) => ({ ...current, smtpHost: event.target.value }))} className="field-input" /></Field>
        <Field label="SMTP Port"><input data-testid="smtp-port-input" disabled={!smtpMode || disabledMode} type="number" min={1} value={form.smtpPort || 0} onChange={(event) => setForm((current) => applyRecommendedPlatformPort(current, Number(event.target.value) || 1))} className="field-input" /></Field>
        <Field label="SMTP Username"><input data-testid="smtp-username-input" disabled={!smtpMode || disabledMode} value={form.smtpUsername || ''} onChange={(event) => setForm((current) => ({ ...current, smtpUsername: event.target.value }))} className="field-input" /></Field>
        <Field label="SMTP Password / Secret"><input data-testid="smtp-password-input" disabled={!smtpMode || disabledMode} type="password" placeholder={form.smtpPasswordMasked || '********'} value={form.smtpPasswordSecret || ''} onChange={(event) => setForm((current) => ({ ...current, smtpPasswordSecret: event.target.value }))} className="field-input" /></Field>
        <Field label="Delivery Endpoint"><input disabled={!apiMode || disabledMode} value={form.apiEndpoint || ''} onChange={(event) => setForm((current) => ({ ...current, apiEndpoint: event.target.value }))} className="field-input" /></Field>
        <Field label="Access Key / Secret"><input disabled={!apiMode || disabledMode} type="password" placeholder={form.apiKeyMasked || '********'} value={form.apiKeySecret || ''} onChange={(event) => setForm((current) => ({ ...current, apiKeySecret: event.target.value }))} className="field-input" /></Field>
        <Field label="Provider Name"><input disabled={!apiMode || disabledMode} value={form.apiProviderName || ''} onChange={(event) => setForm((current) => ({ ...current, apiProviderName: event.target.value }))} className="field-input" /></Field>
        <Field label="Timeout Seconds"><input type="number" min={5} value={form.timeoutSeconds || 30} onChange={(event) => setForm((current) => ({ ...current, timeoutSeconds: Number(event.target.value) || 30 }))} className="field-input" /></Field>
        <Field label="Max Retries"><input type="number" min={0} value={form.maxRetries || 0} onChange={(event) => setForm((current) => ({ ...current, maxRetries: Number(event.target.value) || 0 }))} className="field-input" /></Field>
        <Field label="Sender Name"><input data-testid="sender-name-input" value={form.senderName || ''} onChange={(event) => setForm((current) => ({ ...current, senderName: event.target.value }))} className="field-input" /></Field>
        <Field label="Sender Email"><input data-testid="sender-email-input" type="email" value={form.senderEmail || ''} onChange={(event) => setForm((current) => ({ ...current, senderEmail: event.target.value }))} className="field-input" /></Field>
        <Field label="Reply-to Email"><input data-testid="reply-to-email-input" type="email" value={form.replyToEmail || ''} onChange={(event) => setForm((current) => ({ ...current, replyToEmail: event.target.value }))} className="field-input" /></Field>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <label className="panel-subtle flex items-center justify-between rounded-2xl px-4 py-3"><span className="text-sm text-app">Enable SSL/TLS</span><input type="checkbox" checked={form.enableSslTls} onChange={(event) => setForm((current) => ({ ...current, enableSslTls: event.target.checked }))} /></label>
        <label className="panel-subtle flex items-center justify-between rounded-2xl px-4 py-3"><span className="text-sm text-app">Enable email notifications</span><input data-testid="enable-email-notifications-toggle" type="checkbox" checked={form.enableEmailNotifications} onChange={(event) => setForm((current) => ({ ...current, enableEmailNotifications: event.target.checked }))} /></label>
        <label className="panel-subtle flex items-center justify-between rounded-2xl px-4 py-3"><span className="text-sm text-app">Enable system alerts</span><input type="checkbox" checked={form.enableSystemAlerts} onChange={(event) => setForm((current) => ({ ...current, enableSystemAlerts: event.target.checked }))} /></label>
        <label className="panel-subtle flex items-center justify-between rounded-2xl px-4 py-3"><span className="text-sm text-app">Enable account alert emails</span><input type="checkbox" checked={form.enableInvoiceEmails} onChange={(event) => setForm((current) => ({ ...current, enableInvoiceEmails: event.target.checked }))} /></label>
        <label className="panel-subtle flex items-center justify-between rounded-2xl px-4 py-3"><span className="text-sm text-app">Enable approval emails</span><input type="checkbox" checked={form.enableQuotationEmails} onChange={(event) => setForm((current) => ({ ...current, enableQuotationEmails: event.target.checked }))} /></label>
        <label className="panel-subtle flex items-center justify-between rounded-2xl px-4 py-3"><span className="text-sm text-app">Enable confirmation emails</span><input type="checkbox" checked={form.enablePaymentReceiptEmails} onChange={(event) => setForm((current) => ({ ...current, enablePaymentReceiptEmails: event.target.checked }))} /></label>
        <label className="panel-subtle flex items-center justify-between rounded-2xl px-4 py-3"><span className="text-sm text-app">Enable work order notification emails</span><input type="checkbox" checked={form.enableWorkOrderNotificationEmails} onChange={(event) => setForm((current) => ({ ...current, enableWorkOrderNotificationEmails: event.target.checked }))} /></label>
        <label className="panel-subtle flex items-center justify-between rounded-2xl px-4 py-3"><span className="text-sm text-app">Enable priority response emails</span><input type="checkbox" checked={form.enableSlaEscalationEmails} onChange={(event) => setForm((current) => ({ ...current, enableSlaEscalationEmails: event.target.checked }))} /></label>
        <label className="panel-subtle flex items-center justify-between rounded-2xl px-4 py-3 md:col-span-2 xl:col-span-1"><span className="text-sm text-app">Enable tenant onboarding emails</span><input type="checkbox" checked={form.enableTenantOnboardingEmails} onChange={(event) => setForm((current) => ({ ...current, enableTenantOnboardingEmails: event.target.checked }))} /></label>
      </div>

      <section className="space-y-3">
        <p className="text-sm font-semibold text-app">Notification Preferences</p>
        <div className="space-y-2">
          {form.notificationPreferences.map((item) => (
            <article key={item.notificationKey} className="panel-subtle rounded-2xl px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm font-medium text-app">{preferenceLabels[item.notificationKey] || item.notificationKey}</p>
                <div className="flex flex-wrap gap-3 text-xs">
                  <label className="flex items-center gap-2"><input type="checkbox" checked={item.emailEnabled} onChange={(event) => updatePreference(item.notificationKey, { emailEnabled: event.target.checked })} />Email</label>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={item.inAppEnabled} onChange={(event) => updatePreference(item.notificationKey, { inAppEnabled: event.target.checked })} />In-App</label>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={item.smsEnabled} onChange={(event) => updatePreference(item.notificationKey, { smsEnabled: event.target.checked })} />SMS</label>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={item.isActive} onChange={(event) => updatePreference(item.notificationKey, { isActive: event.target.checked })} />Active</label>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {form.lastError ? <InfoAlert title="Last email delivery error" description={form.lastError} tone="warning" /> : null}
      <div className="grid gap-3 md:grid-cols-[1fr_auto_auto_auto]">
        <Field label="Test Recipient"><input type="email" value={testEmail} onChange={(event) => setTestEmail(event.target.value)} className="field-input" placeholder="ops@example.com (optional)" /></Field>
        <button data-testid="send-test-email-button" type="button" className="button-secondary self-end" onClick={() => void sendTest()} disabled={testing}>{testing ? 'Sending...' : 'Send Test Email'}</button>
        <button data-testid="verify-smtp-button" type="button" className="button-secondary self-end" onClick={() => void verify()} disabled={verifying}>{verifying ? 'Verifying...' : 'Verify Delivery Connection'}</button>
        <button data-testid="save-email-settings-button" type="button" className="button-primary self-end" onClick={() => void save()} disabled={saving}>{saving ? 'Saving...' : 'Save Email Settings'}</button>
      </div>
    </section>
  )
}

function applyRecommendedPlatformPort(current: PlatformEmailSettings, port: number): PlatformEmailSettings {
  if (port === 465) {
    return { ...current, smtpPort: port, enableSslTls: true, secureMode: 'SslOnConnect' }
  }

  if (port === 587) {
    return { ...current, smtpPort: port, enableSslTls: true, secureMode: 'StartTls' }
  }

  return { ...current, smtpPort: port }
}
