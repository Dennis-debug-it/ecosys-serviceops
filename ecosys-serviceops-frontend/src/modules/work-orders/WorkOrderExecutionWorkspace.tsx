import { Camera, CheckCircle2, CirclePause, FileDown, FileSearch, MapPinned, PenSquare, Play, Route, Save, SquareX, UserCheck } from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type { MaterialItem, WorkOrder, WorkOrderExecutionBundle } from '../../types/api'
import { workOrderService } from '../../services/workOrderService'
import { formatDateTime } from '../../utils/date'
import { Badge } from '../../components/ui/Badge'
import { WorkOrderSignaturePad } from './WorkOrderSignaturePad'

type ToastInput = {
  title: string
  description?: string
  tone: 'success' | 'danger' | 'warning' | 'info'
}

type Props = {
  workOrder: WorkOrder
  execution: WorkOrderExecutionBundle | null
  materials: MaterialItem[]
  onReload: () => Promise<void>
  pushToast: (toast: ToastInput) => void
}

const photoCategories = ['Before', 'During', 'After', 'Defect', 'Completion', 'Spare Part', 'Client Sign-off', 'Other'] as const

export function WorkOrderExecutionWorkspace({ workOrder, execution, materials, onReload, pushToast }: Props) {
  const primaryTechnicianId = useMemo(
    () => workOrder.leadTechnicianId || workOrder.assignedTechnicianId || workOrder.technicianAssignments?.[0]?.technicianId || '',
    [workOrder],
  )
  const [selectedTechnicianId, setSelectedTechnicianId] = useState(primaryTechnicianId)
  const [findings, setFindings] = useState(execution?.notes?.findings || workOrder.jobCardNotes || '')
  const [workDone, setWorkDone] = useState(execution?.notes?.workDone || workOrder.workDoneNotes || '')
  const [materialItemId, setMaterialItemId] = useState('')
  const [materialQty, setMaterialQty] = useState(1)
  const [materialUnitCost, setMaterialUnitCost] = useState('')
  const [materialChargeable, setMaterialChargeable] = useState(true)
  const [materialNotes, setMaterialNotes] = useState('')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoCaption, setPhotoCaption] = useState('')
  const [photoCategory, setPhotoCategory] = useState<(typeof photoCategories)[number]>('During')
  const [includeInReport, setIncludeInReport] = useState(true)
  const [signatureType, setSignatureType] = useState<'Technician' | 'Client'>('Technician')
  const [signatureName, setSignatureName] = useState('')
  const [signatureRole, setSignatureRole] = useState('')
  const [signatureComment, setSignatureComment] = useState('')
  const [signatureDataUrl, setSignatureDataUrl] = useState('')
  const [busyAction, setBusyAction] = useState<string | null>(null)

  useEffect(() => {
    setSelectedTechnicianId(primaryTechnicianId)
  }, [primaryTechnicianId])

  useEffect(() => {
    setFindings(execution?.notes?.findings || workOrder.jobCardNotes || '')
    setWorkDone(execution?.notes?.workDone || workOrder.workDoneNotes || '')
  }, [execution?.notes?.findings, execution?.notes?.workDone, workOrder.jobCardNotes, workOrder.workDoneNotes])

  useEffect(() => {
    const existing = execution?.signatures.find((item) => item.signatureType.toLowerCase() === signatureType.toLowerCase())
    setSignatureName(existing?.signerName || (signatureType === 'Technician' ? workOrder.leadTechnicianName || workOrder.assignedTechnicianName || '' : ''))
    setSignatureRole(existing?.signerRole || (signatureType === 'Technician' ? 'Technician' : 'Client Representative'))
    setSignatureComment(existing?.comment || '')
    setSignatureDataUrl(existing?.signatureDataUrl || '')
  }, [execution?.signatures, signatureType, workOrder.assignedTechnicianName, workOrder.leadTechnicianName])

  async function withAction<T>(actionKey: string, operation: () => Promise<T>, successTitle: string, successDescription: string) {
    setBusyAction(actionKey)
    try {
      await operation()
      pushToast({ title: successTitle, description: successDescription, tone: 'success' })
      await onReload()
    } catch (error) {
      pushToast({ title: `${successTitle} failed`, description: error instanceof Error ? error.message : 'The action could not be completed.', tone: 'danger' })
    } finally {
      setBusyAction(null)
    }
  }

  async function getCurrentPosition() {
    if (!('geolocation' in navigator)) return { latitude: null, longitude: null }
    return new Promise<{ latitude: number | null; longitude: number | null }>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
        () => resolve({ latitude: null, longitude: null }),
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 60000 },
      )
    })
  }

  async function saveNotes() {
    await withAction(
      'save-notes',
      () => workOrderService.saveExecutionNotes(workOrder.id, { findings, workDone }),
      'Execution notes saved',
      'Findings and work done were updated.',
    )
  }

  async function acceptJob() {
    if (!selectedTechnicianId) {
      pushToast({ title: 'Technician required', description: 'Select a technician first.', tone: 'warning' })
      return
    }

    await withAction(
      'accept-job',
      () => workOrderService.technicianResponse(workOrder.id, { technicianId: selectedTechnicianId, response: 'Accepted' }),
      'Job accepted',
      'The technician has accepted this job.',
    )
  }

  async function markInTransit() {
    if (!selectedTechnicianId) {
      pushToast({ title: 'Technician required', description: 'Select a technician first.', tone: 'warning' })
      return
    }
    const position = await getCurrentPosition()
    await withAction(
      'mark-in-transit',
      () => workOrderService.markInTransit(workOrder.id, { technicianId: selectedTechnicianId, ...position, inTransitAt: new Date().toISOString() }),
      'In transit recorded',
      'The technician is marked in transit.',
    )
  }

  async function markArrival() {
    if (!selectedTechnicianId) {
      pushToast({ title: 'Technician required', description: 'Select a technician first.', tone: 'warning' })
      return
    }
    const position = await getCurrentPosition()
    await withAction(
      'mark-arrival',
      () => workOrderService.recordArrival(workOrder.id, { technicianId: selectedTechnicianId, ...position, arrivedAt: new Date().toISOString() }),
      'Arrival recorded',
      'The technician arrival was saved.',
    )
  }

  async function startWork() {
    await withAction(
      'start-work',
      () => workOrderService.start(workOrder.id),
      'Work started',
      'The work order is now in progress.',
    )
  }

  async function markDeparture() {
    if (!selectedTechnicianId) {
      pushToast({ title: 'Technician required', description: 'Select a technician first.', tone: 'warning' })
      return
    }
    const position = await getCurrentPosition()
    await withAction(
      'mark-departure',
      () => workOrderService.recordDeparture(workOrder.id, { technicianId: selectedTechnicianId, ...position, departedAt: new Date().toISOString() }),
      'Departure recorded',
      'The technician departure was saved.',
    )
  }

  async function addMaterialUsage() {
    if (!materialItemId || materialQty <= 0) {
      pushToast({ title: 'Material required', description: 'Select a material and quantity first.', tone: 'warning' })
      return
    }

    await withAction(
      'add-material',
      () => workOrderService.addMaterialUsage(workOrder.id, {
        materialItemId,
        assetId: workOrder.assetId || null,
        quantityUsed: materialQty,
        unitCost: materialUnitCost ? Number(materialUnitCost) : null,
        chargeable: materialChargeable,
        notes: materialNotes || null,
        usedAt: new Date().toISOString(),
      }),
      'Material usage saved',
      'Materials and spares used were recorded.',
    )

    setMaterialItemId('')
    setMaterialQty(1)
    setMaterialUnitCost('')
    setMaterialChargeable(true)
    setMaterialNotes('')
  }

  async function uploadPhoto() {
    if (!photoFile) {
      pushToast({ title: 'Photo required', description: 'Choose a photo to upload first.', tone: 'warning' })
      return
    }

    await withAction(
      'upload-photo',
      () => workOrderService.uploadPhoto(workOrder.id, {
        file: photoFile,
        caption: photoCaption || photoFile.name,
        category: photoCategory,
        includeInReport,
      }),
      'Photo uploaded',
      'Evidence photo was added to the work order.',
    )

    setPhotoFile(null)
    setPhotoCaption('')
    setPhotoCategory('During')
    setIncludeInReport(true)
  }

  async function savePhoto(photoId: string, nextCaption: string, nextCategory: string, nextIncludeInReport: boolean) {
    await withAction(
      `save-photo-${photoId}`,
      () => workOrderService.updatePhoto(workOrder.id, photoId, {
        caption: nextCaption,
        category: nextCategory,
        includeInReport: nextIncludeInReport,
      }),
      'Photo updated',
      'Photo caption and report settings were saved.',
    )
  }

  async function saveSignature() {
    if (!signatureName.trim() || !signatureDataUrl) {
      pushToast({ title: 'Signature required', description: 'Capture the signature and enter the signer name first.', tone: 'warning' })
      return
    }

    const actionKey = `save-signature-${signatureType.toLowerCase()}`
    setBusyAction(actionKey)
    try {
      await workOrderService.captureSignature(workOrder.id, {
        signatureType,
        signerName: signatureName.trim(),
        signerRole: signatureRole.trim() || null,
        signatureDataUrl,
        comment: signatureComment.trim() || null,
      })
      await onReload()
      pushToast({ title: `${signatureType} signature saved`, description: 'The signature was attached to this work order.', tone: 'success' })
    } catch (error) {
      pushToast({ title: `${signatureType} signature saved failed`, description: error instanceof Error ? error.message : 'The action could not be completed.', tone: 'danger' })
    } finally {
      setBusyAction(null)
    }
  }

  async function completeWorkOrder() {
    if (!workDone.trim()) {
      pushToast({ title: 'Work done required', description: 'Record the work done before completing the job.', tone: 'warning' })
      return
    }

    await withAction(
      'complete-work-order',
      () => workOrderService.complete(workOrder.id, {
        workDoneNotes: workDone.trim(),
        technicianId: selectedTechnicianId || null,
        assignmentGroupId: workOrder.assignmentGroupId || null,
        reportSummary: workDone.trim(),
      }),
      'Work order completed',
      'The service report data has been finalized.',
    )
  }

  async function pauseWork() {
    await withAction(
      'pause-work',
      () => workOrderService.pause(workOrder.id),
      'Work paused',
      'The work order has been paused.',
    )
  }

  async function resumeWork() {
    await withAction(
      'resume-work',
      () => workOrderService.resume(workOrder.id),
      'Work resumed',
      'The work order is back in progress.',
    )
  }

  async function closeWorkOrder() {
    await withAction(
      'close-work-order',
      () => workOrderService.close(workOrder.id),
      'Work order closed',
      'The work order has been closed.',
    )
  }

  async function cancelWorkOrder() {
    await withAction(
      'cancel-work-order',
      () => workOrderService.cancel(workOrder.id),
      'Work order cancelled',
      'The work order has been cancelled.',
    )
  }

  async function generateReportPreview() {
    setBusyAction('generate-report')
    try {
      await workOrderService.generateServiceReport(workOrder.id)
      pushToast({ title: 'Report generated', description: 'The service report preview has been refreshed.', tone: 'success' })
      await onReload()
    } catch (error) {
      pushToast({ title: 'Generate failed', description: error instanceof Error ? error.message : 'The report could not be generated.', tone: 'danger' })
    } finally {
      setBusyAction(null)
    }
  }

  async function downloadReport() {
    setBusyAction('download-report')
    try {
      await workOrderService.downloadServiceReportPdf(workOrder.id)
      pushToast({ title: 'Report downloaded', description: 'The service report PDF is downloading.', tone: 'success' })
    } catch (error) {
      pushToast({ title: 'Download failed', description: error instanceof Error ? error.message : 'The PDF could not be downloaded.', tone: 'danger' })
    } finally {
      setBusyAction(null)
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
      <div className="space-y-6">
        <section className="surface-card space-y-4" data-testid="work-order-execution-panel">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-app">Execution workflow</h3>
              <p className="text-sm text-muted">Run the field job, capture evidence, and finalize the service report from saved work order data.</p>
            </div>
            <Badge tone="info">{workOrder.status}</Badge>
          </div>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-app">Technician</span>
            <select
              value={selectedTechnicianId}
              onChange={(event) => setSelectedTechnicianId(event.target.value)}
              className="field-input"
              data-testid="execution-technician-select"
            >
              <option value="">Select technician</option>
              {workOrder.technicianAssignments?.map((assignment) => (
                <option key={assignment.technicianId} value={assignment.technicianId}>
                  {assignment.technicianName || 'Technician'}
                </option>
              ))}
            </select>
          </label>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <ActionButton icon={<UserCheck className="size-4" />} label="Accept job" testId="action-accept-job" busy={busyAction === 'accept-job'} onClick={acceptJob} />
            <ActionButton icon={<Route className="size-4" />} label="Mark in transit" testId="action-mark-in-transit" busy={busyAction === 'mark-in-transit'} onClick={markInTransit} />
            <ActionButton icon={<MapPinned className="size-4" />} label="Mark arrived" testId="action-mark-arrived" busy={busyAction === 'mark-arrival'} onClick={markArrival} />
            <ActionButton icon={<Play className="size-4" />} label="Start work" testId="action-start-work" busy={busyAction === 'start-work'} onClick={startWork} />
            <ActionButton icon={<CirclePause className="size-4" />} label="Pause work" testId="action-pause-work" busy={busyAction === 'pause-work'} onClick={pauseWork} />
            <ActionButton icon={<Play className="size-4" />} label="Resume work" testId="action-resume-work" busy={busyAction === 'resume-work'} onClick={resumeWork} />
            <ActionButton icon={<CheckCircle2 className="size-4" />} label="Complete work" testId="action-complete-work" busy={busyAction === 'complete-work-order'} onClick={completeWorkOrder} />
            <ActionButton icon={<MapPinned className="size-4" />} label="Mark departed" testId="action-mark-departed" busy={busyAction === 'mark-departure'} onClick={markDeparture} />
            <ActionButton icon={<CheckCircle2 className="size-4" />} label="Close work order" testId="action-close-work-order" busy={busyAction === 'close-work-order'} onClick={closeWorkOrder} />
            <ActionButton icon={<SquareX className="size-4" />} label="Cancel work order" testId="action-cancel-work-order" busy={busyAction === 'cancel-work-order'} onClick={cancelWorkOrder} />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {(execution?.reportPreview.timestamps || []).map((timestamp) => (
              <div key={timestamp.label} className="panel-subtle rounded-2xl p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">{timestamp.label}</p>
                <p className="mt-2 text-sm font-medium text-app">{timestamp.value || 'Not recorded'}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="surface-card space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-app">Findings and work done</h3>
              <p className="text-sm text-muted">These notes feed directly into the generated service report.</p>
            </div>
            <button type="button" className="button-primary" onClick={() => void saveNotes()} disabled={busyAction === 'save-notes'} data-testid="save-execution-notes">
              <Save className="size-4" />
              {busyAction === 'save-notes' ? 'Saving...' : 'Save notes'}
            </button>
          </div>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-app">Findings</span>
            <textarea value={findings} onChange={(event) => setFindings(event.target.value)} className="field-input min-h-[140px]" data-testid="findings-input" />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-app">Work done</span>
            <textarea value={workDone} onChange={(event) => setWorkDone(event.target.value)} className="field-input min-h-[140px]" data-testid="work-done-input" />
          </label>
        </section>

        <section className="surface-card space-y-4" data-testid="work-order-materials-used">
          <div>
            <h3 className="text-lg font-semibold text-app">Materials / spares used</h3>
            <p className="text-sm text-muted">Record what was consumed on the job so the report and stock history stay aligned.</p>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <select value={materialItemId} onChange={(event) => setMaterialItemId(event.target.value)} className="field-input" data-testid="material-select">
              <option value="">Select material</option>
              {materials.map((material) => (
                <option key={material.id} value={material.id}>
                  {material.itemName} ({material.quantityOnHand} {material.unitOfMeasure})
                </option>
              ))}
            </select>
            <input type="number" min={0.01} step="0.01" value={materialQty} onChange={(event) => setMaterialQty(Number(event.target.value) || 1)} className="field-input" placeholder="Quantity used" />
            <input value={materialUnitCost} onChange={(event) => setMaterialUnitCost(event.target.value)} className="field-input" placeholder="Unit cost" />
            <label className="panel-subtle flex items-center gap-3 rounded-2xl px-4 py-3 text-sm text-app">
              <input type="checkbox" checked={materialChargeable} onChange={(event) => setMaterialChargeable(event.target.checked)} />
              Chargeable
            </label>
          </div>

          <textarea value={materialNotes} onChange={(event) => setMaterialNotes(event.target.value)} className="field-input min-h-[96px]" placeholder="Usage notes" />

          <div className="flex justify-end">
            <button type="button" className="button-primary" onClick={() => void addMaterialUsage()} disabled={busyAction === 'add-material'} data-testid="add-material-usage">
              {busyAction === 'add-material' ? 'Saving...' : 'Add material usage'}
            </button>
          </div>

          <div className="space-y-3">
            {(execution?.materialUsages || []).length === 0 ? (
              <div className="panel-subtle rounded-2xl p-4 text-sm text-muted">No materials or spares have been recorded yet.</div>
            ) : (
              execution?.materialUsages.map((usage) => (
                <div key={usage.id} className="panel-subtle rounded-2xl p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-app">{usage.materialName || 'Material'}</p>
                      <p className="text-sm text-muted">
                        {usage.quantityUsed} {usage.unitOfMeasure || 'unit'}{usage.unitCost != null ? ` @ ${usage.unitCost}` : ''} • {usage.chargeable ? 'Chargeable' : 'Non-chargeable'}
                      </p>
                    </div>
                    <p className="text-xs text-muted">{formatDateTime(usage.usedAt)}</p>
                  </div>
                  {usage.notes ? <p className="mt-3 text-sm text-muted">{usage.notes}</p> : null}
                </div>
              ))
            )}
          </div>
        </section>

        <section className="surface-card space-y-4" data-testid="work-order-photos">
          <div>
            <h3 className="text-lg font-semibold text-app">Photo evidence</h3>
            <p className="text-sm text-muted">Upload job photos, caption them, choose a report category, and decide whether each one appears in the PDF.</p>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="field-input"
              data-testid="photo-file-input"
              onChange={(event) => setPhotoFile(event.target.files?.[0] || null)}
            />
            <input value={photoCaption} onChange={(event) => setPhotoCaption(event.target.value)} className="field-input" placeholder="Caption / footer" data-testid="photo-caption-input" />
            <select value={photoCategory} onChange={(event) => setPhotoCategory(event.target.value as (typeof photoCategories)[number])} className="field-input">
              {photoCategories.map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
            <label className="panel-subtle flex items-center gap-3 rounded-2xl px-4 py-3 text-sm text-app">
              <input type="checkbox" checked={includeInReport} onChange={(event) => setIncludeInReport(event.target.checked)} />
              Include in report
            </label>
          </div>

          <div className="flex justify-end">
            <button type="button" className="button-primary" onClick={() => void uploadPhoto()} disabled={busyAction === 'upload-photo'} data-testid="upload-photo-button">
              <Camera className="size-4" />
              {busyAction === 'upload-photo' ? 'Uploading...' : 'Upload photo'}
            </button>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            {(execution?.photos || []).length === 0 ? (
              <div className="panel-subtle rounded-2xl p-4 text-sm text-muted">No photos have been uploaded yet.</div>
            ) : (
              execution?.photos.map((photo) => <EditablePhotoCard key={photo.id} photo={photo} onSave={savePhoto} busy={busyAction === `save-photo-${photo.id}`} />)
            )}
          </div>
        </section>

        <section className="surface-card space-y-4" data-testid="work-order-signatures">
          <div>
            <h3 className="text-lg font-semibold text-app">Signatures</h3>
            <p className="text-sm text-muted">Capture both the technician and client sign-off before completing the work order.</p>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <select value={signatureType} onChange={(event) => setSignatureType(event.target.value as 'Technician' | 'Client')} className="field-input" data-testid="signature-type-select">
              <option value="Technician">Technician signature</option>
              <option value="Client">Client / user signature</option>
            </select>
            <input value={signatureName} onChange={(event) => setSignatureName(event.target.value)} className="field-input" placeholder="Signer name" data-testid="signature-name-input" />
            <input value={signatureRole} onChange={(event) => setSignatureRole(event.target.value)} className="field-input" placeholder="Role / title" />
          </div>

          <textarea value={signatureComment} onChange={(event) => setSignatureComment(event.target.value)} className="field-input min-h-[96px]" placeholder="Optional comment" />

          <WorkOrderSignaturePad value={signatureDataUrl} onChange={setSignatureDataUrl} dataTestId="signature-pad" />

          <div className="flex justify-end">
            <button type="button" className="button-primary" onClick={() => void saveSignature()} disabled={busyAction === `save-signature-${signatureType.toLowerCase()}`} data-testid="save-signature-button">
              <PenSquare className="size-4" />
              {busyAction === `save-signature-${signatureType.toLowerCase()}` ? 'Saving...' : `Save ${signatureType.toLowerCase()} signature`}
            </button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {(execution?.signatures || []).map((signature) => (
              <div key={signature.id} className="panel-subtle rounded-2xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-app">{signature.signatureType}</p>
                    <p className="text-sm text-muted">{signature.signerName}{signature.signerRole ? ` • ${signature.signerRole}` : ''}</p>
                  </div>
                  <p className="text-xs text-muted">{formatDateTime(signature.capturedAt)}</p>
                </div>
                <img src={signature.signatureDataUrl} alt={`${signature.signatureType} signature`} className="mt-3 h-20 rounded-xl border border-slate-200 bg-white object-contain" />
                {signature.comment ? <p className="mt-3 text-sm text-muted">{signature.comment}</p> : null}
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="space-y-6">
        <section className="surface-card space-y-4" data-testid="work-order-service-report">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-app">Service report preview</h3>
              <p className="text-sm text-muted">This preview is generated from the saved work order data and matches the downloadable PDF.</p>
            </div>
            <button type="button" className="button-primary" onClick={() => void downloadReport()} disabled={busyAction === 'download-report'} data-testid="download-service-report">
              <FileDown className="size-4" />
              {busyAction === 'download-report' ? 'Preparing...' : 'Download PDF'}
            </button>
            <button type="button" className="button-secondary" onClick={() => void generateReportPreview()} disabled={busyAction === 'generate-report'} data-testid="generate-service-report">
              <FileSearch className="size-4" />
              {busyAction === 'generate-report' ? 'Generating...' : 'Generate report'}
            </button>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="border-b border-slate-200 pb-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{execution?.reportPreview.companyName || 'Service report'}</p>
              <h4 className="mt-2 text-xl font-semibold text-slate-900">{execution?.reportPreview.workOrderNumber} • {execution?.reportPreview.title}</h4>
              <p className="mt-1 text-sm text-slate-500">{execution?.reportPreview.generatedAtLabel}</p>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <PreviewBlock label="Client" value={execution?.reportPreview.clientName} />
              <PreviewBlock label="Site / Location" value={execution?.reportPreview.siteLabel} />
              <PreviewBlock label="Asset" value={execution?.reportPreview.assetName} />
              <PreviewBlock label="Technician / Team" value={execution?.reportPreview.technicianTeam} />
            </div>

            <PreviewText label="Problem reported" value={execution?.reportPreview.reportedProblem} />
            <PreviewText label="Findings" value={execution?.reportPreview.findings} />
            <PreviewText label="Work done" value={execution?.reportPreview.workDone} />

            <div className="mt-5 space-y-3">
              <p className="text-sm font-semibold text-slate-900">Materials / spares used</p>
              {(execution?.reportPreview.materials || []).length === 0 ? (
                <p className="text-sm text-slate-500">No materials recorded.</p>
              ) : (
                execution?.reportPreview.materials.map((material, index) => (
                  <div key={`${material.name}-${index}`} className="rounded-2xl border border-slate-200 p-3">
                    <p className="font-medium text-slate-900">{material.name}</p>
                    <p className="text-sm text-slate-500">
                      {material.quantityUsed} {material.unitOfMeasure}{material.unitCost != null ? ` @ ${material.unitCost}` : ''} • {material.chargeable ? 'Chargeable' : 'Non-chargeable'}
                    </p>
                    {material.notes ? <p className="mt-2 text-sm text-slate-600">{material.notes}</p> : null}
                  </div>
                ))
              )}
            </div>

            <div className="mt-5 space-y-3">
              <p className="text-sm font-semibold text-slate-900">Photos grouped by category</p>
              {(execution?.reportPreview.photoGroups || []).length === 0 ? (
                <p className="text-sm text-slate-500">No report photos selected yet.</p>
              ) : (
                execution?.reportPreview.photoGroups.map((group) => (
                  <div key={group.category} className="space-y-3 rounded-2xl border border-slate-200 p-3">
                    <p className="font-medium text-slate-900">{group.category}</p>
                    <div className="grid gap-3">
                      {group.photos.map((photo, index) => (
                        <div key={`${group.category}-${index}`} className="rounded-2xl bg-slate-50 p-3">
                          {photo.publicUrl ? <img src={photo.publicUrl} alt={photo.caption} className="h-36 w-full rounded-xl object-cover" /> : null}
                          <p className="mt-2 text-sm text-slate-700">{photo.caption}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="mt-5 space-y-3">
              <p className="text-sm font-semibold text-slate-900">Signatures</p>
              <div className="grid gap-3 md:grid-cols-2">
                {(execution?.reportPreview.signatures || []).map((signature) => (
                  <div key={signature.signatureType} className="rounded-2xl border border-slate-200 p-3">
                    <p className="font-medium text-slate-900">{signature.signatureType}</p>
                    <p className="text-sm text-slate-500">{signature.signerName}{signature.signerRole ? ` • ${signature.signerRole}` : ''}</p>
                    <p className="mt-1 text-xs text-slate-400">{signature.capturedAtLabel}</p>
                    {signature.comment ? <p className="mt-2 text-sm text-slate-600">{signature.comment}</p> : null}
                  </div>
                ))}
              </div>
            </div>

            {execution?.reportPreview.showPoweredByEcosys ? <p className="mt-6 text-center text-xs text-slate-400">Powered by Ecosys</p> : null}
          </div>
        </section>
      </div>
    </div>
  )
}

function ActionButton({
  icon,
  label,
  testId,
  busy,
  onClick,
}: {
  icon: ReactNode
  label: string
  testId: string
  busy: boolean
  onClick: () => void
}) {
  return (
    <button type="button" className="button-secondary justify-start" onClick={onClick} disabled={busy} data-testid={testId}>
      {icon}
      {busy ? 'Working...' : label}
    </button>
  )
}

function PreviewBlock({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-3">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-2 text-sm font-medium text-slate-900">{value || 'Not recorded'}</p>
    </div>
  )
}

function PreviewText({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="mt-5">
      <p className="text-sm font-semibold text-slate-900">{label}</p>
      <p className="mt-2 text-sm text-slate-600">{value || 'Not recorded.'}</p>
    </div>
  )
}

function EditablePhotoCard({
  photo,
  onSave,
  busy,
}: {
  photo: WorkOrderExecutionBundle['photos'][number]
  onSave: (photoId: string, caption: string, category: string, includeInReport: boolean) => Promise<void>
  busy: boolean
}) {
  const [caption, setCaption] = useState(photo.caption)
  const [category, setCategory] = useState(photo.category)
  const [includeInReport, setIncludeInReport] = useState(photo.includeInReport)

  useEffect(() => {
    setCaption(photo.caption)
    setCategory(photo.category)
    setIncludeInReport(photo.includeInReport)
  }, [photo.caption, photo.category, photo.includeInReport])

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      {photo.publicUrl ? <img src={photo.publicUrl} alt={photo.caption} className="h-52 w-full rounded-2xl object-cover" /> : null}
      <div className="mt-4 space-y-3">
        <input value={caption} onChange={(event) => setCaption(event.target.value)} className="field-input" />
        <select value={category} onChange={(event) => setCategory(event.target.value)} className="field-input">
          {photoCategories.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
        <label className="panel-subtle flex items-center gap-3 rounded-2xl px-4 py-3 text-sm text-app">
          <input type="checkbox" checked={includeInReport} onChange={(event) => setIncludeInReport(event.target.checked)} />
          Include in report
        </label>
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted">{formatDateTime(photo.uploadedAt)}</p>
          <button type="button" className="button-secondary" onClick={() => void onSave(photo.id, caption, category, includeInReport)} disabled={busy}>
            {busy ? 'Saving...' : 'Save photo details'}
          </button>
        </div>
      </div>
    </div>
  )
}
