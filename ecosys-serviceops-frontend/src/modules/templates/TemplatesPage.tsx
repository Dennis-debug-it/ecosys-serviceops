import { Copy, Plus, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Badge } from '../../components/ui/Badge'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { EmptyState } from '../../components/ui/EmptyState'
import { ErrorState } from '../../components/ui/ErrorState'
import { LoadingState } from '../../components/ui/LoadingState'
import { Modal } from '../../components/ui/Modal'
import { PageHeader } from '../../components/ui/PageHeader'
import { useToast } from '../../components/ui/ToastProvider'
import { useAsyncData } from '../../hooks/useAsyncData'
import { pmTemplateService } from '../../services/pmTemplateService'
import type { PmTemplateRecord, UpsertPmTemplateInput } from '../../types/api'

const categories = ['HVAC', 'Generator', 'UPS', 'Solar'] as const
const answerTypes = ['text', 'yesno', 'passfail', 'number', 'date', 'dropdown', 'boolean'] as const

type TemplateCategory = (typeof categories)[number]

const emptyDraft = (): UpsertPmTemplateInput => ({
  name: '',
  category: 'HVAC',
  description: '',
  checklist: [
    {
      sectionName: '',
      question: '',
      type: 'text',
      required: true,
      order: 1,
      options: [],
    },
  ],
  isActive: true,
})

export function TemplatesPage() {
  const { pushToast } = useToast()
  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState<PmTemplateRecord | null>(null)
  const [draft, setDraft] = useState<UpsertPmTemplateInput>(emptyDraft)
  const [saveError, setSaveError] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<PmTemplateRecord | null>(null)
  const [deleting, setDeleting] = useState(false)

  const { data, loading, error, reload } = useAsyncData<PmTemplateRecord[]>(
    (signal) => pmTemplateService.list(signal),
    [],
    [],
  )

  const groupedTemplates = useMemo(
    () =>
      categories.map((category) => ({
        category,
        templates: data.filter((item) => item.category === category),
      })),
    [data],
  )

  const isDraftValid = draft.name.trim().length > 0
    && draft.checklist.length > 0
    && draft.checklist.every((item) => item.question.trim().length > 0 && (item.type !== 'dropdown' || (item.options?.length ?? 0) > 0))

  function openCreateModal(category: TemplateCategory = 'HVAC') {
    setEditing(null)
    setSaveError('')
    setDraft({
      ...emptyDraft(),
      category,
    })
    setEditorOpen(true)
  }

  function openEditModal(template: PmTemplateRecord) {
    setEditing(template)
    setSaveError('')
    setDraft({
      name: template.name,
      category: template.category,
      description: template.description ?? '',
      checklist: template.checklist.map((item) => ({
        sectionName: item.sectionName ?? '',
        question: item.question,
        type: item.type,
        required: item.required,
        order: item.order,
        options: item.options ?? [],
      })),
      isActive: template.isActive,
    })
    setEditorOpen(true)
  }

  async function saveTemplate() {
    if (!isDraftValid || saving) return

    setSaving(true)
    setSaveError('')

    const payload: UpsertPmTemplateInput = {
      ...draft,
      name: draft.name.trim(),
      description: draft.description?.trim() || null,
      checklist: draft.checklist.map((item, index) => ({
        sectionName: item.sectionName?.trim() || null,
        question: item.question.trim(),
        type: item.type,
        required: item.required,
        order: index + 1,
        options: item.type === 'dropdown' ? (item.options ?? []).map((option) => option.trim()).filter(Boolean) : [],
      })),
    }

    try {
      if (editing) {
        await pmTemplateService.update(editing.id, payload)
        pushToast({ title: 'Template updated', description: 'The PM template changes were saved.', tone: 'success' })
      } else {
        await pmTemplateService.create(payload)
        pushToast({ title: 'Template created', description: 'The PM template is now available for planning.', tone: 'success' })
      }

      setDraft(emptyDraft())
      setEditing(null)
      setEditorOpen(false)
      await reload()
    } catch (nextError) {
      setSaveError(nextError instanceof Error ? nextError.message : 'Unable to save the template.')
    } finally {
      setSaving(false)
    }
  }

  async function duplicateTemplate(template: PmTemplateRecord) {
    try {
      await pmTemplateService.create({
        name: `${template.name} Copy`,
        category: template.category,
        description: template.description ?? '',
        checklist: template.checklist.map((item, index) => ({
          sectionName: item.sectionName ?? '',
          question: item.question,
          type: item.type,
          required: item.required,
          order: index + 1,
          options: item.options ?? [],
        })),
        isActive: template.isActive,
      })
      pushToast({ title: 'Template duplicated', description: 'A copy was created successfully.', tone: 'success' })
      await reload()
    } catch (nextError) {
      pushToast({ title: 'Duplicate failed', description: nextError instanceof Error ? nextError.message : 'Unable to duplicate the template.', tone: 'danger' })
    }
  }

  async function confirmDeleteTemplate() {
    if (!deleteTarget || deleting) return

    setDeleting(true)
    try {
      await pmTemplateService.remove(deleteTarget.id)
      pushToast({ title: 'Template deleted', description: 'The PM template has been removed.', tone: 'success' })
      setDeleteTarget(null)
      if (editing?.id === deleteTarget.id) {
        setEditing(null)
        setDraft(emptyDraft())
        setEditorOpen(false)
      }
      await reload()
    } catch (nextError) {
      pushToast({ title: 'Delete failed', description: nextError instanceof Error ? nextError.message : 'Unable to delete the template.', tone: 'danger' })
    } finally {
      setDeleting(false)
    }
  }

  function updateChecklistItem(index: number, updater: (item: UpsertPmTemplateInput['checklist'][number]) => UpsertPmTemplateInput['checklist'][number]) {
    setDraft((current) => ({
      ...current,
      checklist: current.checklist.map((item, itemIndex) => (itemIndex === index ? updater(item) : item)),
    }))
  }

  function moveChecklistItem(index: number, direction: -1 | 1) {
    setDraft((current) => {
      const nextIndex = index + direction
      if (nextIndex < 0 || nextIndex >= current.checklist.length) {
        return current
      }

      const checklist = [...current.checklist]
      const [moved] = checklist.splice(index, 1)
      checklist.splice(nextIndex, 0, moved)
      return {
        ...current,
        checklist: checklist.map((item, itemIndex) => ({ ...item, order: itemIndex + 1 })),
      }
    })
  }

  function removeChecklistItem(index: number) {
    setDraft((current) => ({
      ...current,
      checklist: current.checklist
        .filter((_, itemIndex) => itemIndex !== index)
        .map((item, itemIndex) => ({ ...item, order: itemIndex + 1 })),
    }))
  }

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Templates"
        title="Preventive maintenance templates"
        description="Create and maintain live PM templates for HVAC, Generator, UPS, and Solar checklists."
        actions={
          <button type="button" className="button-primary" onClick={() => openCreateModal()}>
            <Plus className="h-4 w-4" />
            New template
          </button>
        }
      />

      {loading ? <LoadingState label="Loading templates" /> : null}
      {!loading && error ? <ErrorState title="Unable to load templates" description={error} /> : null}
      {!loading && !error && data.length === 0 ? (
        <EmptyState
          title="No templates yet"
          description="Create the first PM template to start building reusable checklists for field teams."
          actionLabel="Create template"
          onAction={() => openCreateModal()}
        />
      ) : null}

      {!loading && !error && data.length > 0 ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {groupedTemplates.map(({ category, templates }) => (
            <section key={category} className="surface-card">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold text-app">{category}</p>
                  <p className="text-sm text-muted">{templates.length} template{templates.length === 1 ? '' : 's'} in this category.</p>
                </div>
                <button type="button" className="button-secondary" onClick={() => openCreateModal(category)}>
                  <Plus className="h-4 w-4" />
                  Add
                </button>
              </div>

              {templates.length === 0 ? (
                <div className="panel-subtle rounded-2xl p-4 text-sm text-muted">No templates in this category yet.</div>
              ) : (
                <div className="space-y-3">
                  {templates.map((template) => (
                    <div key={template.id} className="panel-subtle rounded-2xl p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold text-app">{template.name}</p>
                          <p className="mt-1 text-sm text-muted">{template.description || 'No description provided yet.'}</p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <Badge tone={template.isActive ? 'success' : 'neutral'}>{template.isActive ? 'Active' : 'Inactive'}</Badge>
                            <Badge tone="info">{template.checklist.length} questions</Badge>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button type="button" className="button-secondary px-3 py-2" onClick={() => openEditModal(template)}>
                            Edit
                          </button>
                          <button type="button" className="button-secondary px-3 py-2" onClick={() => void duplicateTemplate(template)}>
                            <Copy className="h-4 w-4" />
                            Duplicate
                          </button>
                          <button type="button" className="button-secondary px-3 py-2 text-rose-200" onClick={() => setDeleteTarget(template)}>
                            <Trash2 className="h-4 w-4" />
                            Delete
                          </button>
                        </div>
                      </div>

                      <div className="mt-4 space-y-2">
                        {template.checklist.slice(0, 4).map((item) => (
                          <div key={item.id} className="rounded-2xl border border-app px-4 py-3 text-sm">
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-app">{item.order}. {item.question}</span>
                              <div className="flex gap-2">
                                <Badge tone="neutral">{item.type}</Badge>
                                {item.required ? <Badge tone="warning">Required</Badge> : null}
                              </div>
                            </div>
                          </div>
                        ))}
                        {template.checklist.length > 4 ? (
                          <p className="text-xs text-muted">+ {template.checklist.length - 4} more questions</p>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
      ) : null}

      <Modal
        open={editorOpen}
        title={editing ? 'Edit PM template' : 'Create PM template'}
        description="Build a reusable PM checklist. The form only resets after a successful save."
        onClose={() => {
          if (saving) return
          setEditorOpen(false)
          setSaveError('')
        }}
        maxWidth="max-w-4xl"
      >
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block space-y-2">
              <span className="text-sm font-medium text-app">Template name</span>
              <input value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} className="field-input" />
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-medium text-app">Category</span>
              <select value={draft.category} onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value as TemplateCategory }))} className="field-input">
                {categories.map((category) => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </label>
          </div>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-app">Description</span>
            <textarea value={draft.description || ''} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} className="field-input min-h-[110px]" />
          </label>

          <label className="panel-subtle flex items-center justify-between rounded-2xl px-4 py-3">
            <span className="text-sm text-app">Template is active</span>
            <input type="checkbox" checked={draft.isActive} onChange={(event) => setDraft((current) => ({ ...current, isActive: event.target.checked }))} />
          </label>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-lg font-semibold text-app">Checklist</p>
                <p className="text-sm text-muted">Add, remove, and reorder checklist questions before saving.</p>
              </div>
              <button
                type="button"
                className="button-secondary"
                onClick={() =>
                  setDraft((current) => ({
                    ...current,
                    checklist: [
                      ...current.checklist,
                      {
                        sectionName: '',
                        question: '',
                        type: 'text',
                        required: true,
                        order: current.checklist.length + 1,
                        options: [],
                      },
                    ],
                  }))}
              >
                <Plus className="h-4 w-4" />
                Add question
              </button>
            </div>

            {draft.checklist.map((item, index) => (
              <div key={`${item.order}-${index}`} className="rounded-[24px] border border-app p-4">
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_180px_120px_auto]">
                  <label className="block space-y-2 lg:col-span-4">
                    <span className="text-sm font-medium text-app">Section</span>
                    <input
                      value={item.sectionName || ''}
                      onChange={(event) => updateChecklistItem(index, (current) => ({ ...current, sectionName: event.target.value }))}
                      className="field-input"
                      placeholder="Visual Inspection"
                    />
                  </label>
                  <label className="block space-y-2">
                    <span className="text-sm font-medium text-app">Question {index + 1}</span>
                    <input
                      value={item.question}
                      onChange={(event) => updateChecklistItem(index, (current) => ({ ...current, question: event.target.value }))}
                      className="field-input"
                    />
                  </label>
                  <label className="block space-y-2">
                    <span className="text-sm font-medium text-app">Answer type</span>
                    <select
                      value={item.type}
                      onChange={(event) =>
                        updateChecklistItem(index, (current) => ({
                          ...current,
                          type: event.target.value as UpsertPmTemplateInput['checklist'][number]['type'],
                          options: event.target.value === 'dropdown' ? current.options ?? [''] : [],
                        }))}
                      className="field-input"
                    >
                      {answerTypes.map((type) => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                  </label>
                  <label className="panel-subtle mt-7 flex items-center justify-between rounded-2xl px-4 py-3">
                    <span className="text-sm text-app">Required</span>
                    <input
                      type="checkbox"
                      checked={item.required}
                      onChange={(event) => updateChecklistItem(index, (current) => ({ ...current, required: event.target.checked }))}
                    />
                  </label>
                  <div className="mt-7 flex flex-wrap justify-end gap-2">
                    <button type="button" className="button-secondary px-3 py-2" onClick={() => moveChecklistItem(index, -1)} disabled={index === 0}>
                      Up
                    </button>
                    <button type="button" className="button-secondary px-3 py-2" onClick={() => moveChecklistItem(index, 1)} disabled={index === draft.checklist.length - 1}>
                      Down
                    </button>
                    <button type="button" className="button-secondary px-3 py-2 text-rose-200" onClick={() => removeChecklistItem(index)} disabled={draft.checklist.length === 1}>
                      Delete
                    </button>
                  </div>
                </div>
                {item.type === 'dropdown' ? (
                  <label className="mt-4 block space-y-2">
                    <span className="text-sm font-medium text-app">Dropdown options</span>
                    <input
                      value={(item.options ?? []).join(', ')}
                      onChange={(event) =>
                        updateChecklistItem(index, (current) => ({
                          ...current,
                          options: event.target.value.split(',').map((option) => option.trim()).filter(Boolean),
                        }))}
                      className="field-input"
                      placeholder="Option A, Option B, Option C"
                    />
                  </label>
                ) : null}
              </div>
            ))}
          </div>

          {saveError ? <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{saveError}</div> : null}

          <div className="flex justify-end gap-3">
            <button type="button" className="button-secondary" onClick={() => setEditorOpen(false)} disabled={saving}>
              Cancel
            </button>
            <button type="button" className="button-primary" onClick={() => void saveTemplate()} disabled={!isDraftValid || saving}>
              {saving ? 'Saving template...' : editing ? 'Save changes' : 'Create template'}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete PM template"
        description={`Delete ${deleteTarget?.name ?? 'this template'}? This cannot be undone.`}
        confirmLabel={deleting ? 'Deleting...' : 'Delete template'}
        onCancel={() => {
          if (!deleting) {
            setDeleteTarget(null)
          }
        }}
        onConfirm={() => void confirmDeleteTemplate()}
      />
    </div>
  )
}
