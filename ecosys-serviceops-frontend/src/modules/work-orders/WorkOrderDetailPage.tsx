import { ArrowLeft, CheckCircle2, ClipboardCheck, MessageSquarePlus, PackagePlus, Play, Square } from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AttachmentPanel } from '../../components/ui/AttachmentPanel'
import { attachmentService, ATTACHMENT_ENTITY_TYPES } from '../../services/attachmentService'
import type { AttachmentRecord } from '../../types/api'
import { useAuth } from '../../auth/AuthContext'
import { KipButton } from '../../components/kip/KipButton'
import { KipPanel } from '../../components/kip/KipPanel'
import { Badge } from '../../components/ui/Badge'
import { EmptyState } from '../../components/ui/EmptyState'
import { ErrorState } from '../../components/ui/ErrorState'
import { LoadingState } from '../../components/ui/LoadingState'
import { Modal } from '../../components/ui/Modal'
import { useToast } from '../../components/ui/ToastProvider'
import { MetricCard, MetricGrid, PageScaffold, PageTabs, SectionCard, StickyActionFooter } from '../../components/ui/Workspace'
import { useAsyncData } from '../../hooks/useAsyncData'
import { knowledgeService } from '../../services/knowledgeService'
import { materialService } from '../../services/materialService'
import { pmTemplateService } from '../../services/pmTemplateService'
import { settingsService } from '../../services/settingsService'
import { technicianService } from '../../services/technicianService'
import { workOrderService } from '../../services/workOrderService'
import type { AssignmentGroupRecord, KnowledgeArticleListItem, MaterialItem, MaterialRequestRecord, PmTemplateRecord, TechnicianRecord, WorkOrder, WorkOrderAssignmentHistoryRecord, WorkOrderChecklistItemRecord, WorkOrderEventRecord, WorkOrderExecutionBundle } from '../../types/api'
import { formatDateOnly, formatDateTime } from '../../utils/date'
import { priorityTone, statusTone } from '../../utils/format'
import { WorkOrderExecutionWorkspace } from './WorkOrderExecutionWorkspace'

type DetailTab = 'overview' | 'timeline' | 'materials' | 'attachments' | 'documents' | 'checklist' | 'audit'

type WorkOrderDetailPayload = {
  workOrder: WorkOrder | null
  execution: WorkOrderExecutionBundle | null
  materials: MaterialItem[]
  technicians: TechnicianRecord[]
  materialRequests: MaterialRequestRecord[]
  events: WorkOrderEventRecord[]
  assignmentHistory: WorkOrderAssignmentHistoryRecord[]
  assignmentGroups: AssignmentGroupRecord[]
  pmTemplates: PmTemplateRecord[]
}

type ChecklistDraft = {
  responseValue: string
  remarks: string
  isCompleted: boolean
}

type TimelineEntry = {
  id: string
  title: string
  when: string
  body: string
  badge?: { label: string; tone: 'default' | 'info' | 'success' | 'warning' | 'danger' | 'neutral' }
  meta?: string | null
}

const detailTabs: Array<{ id: DetailTab; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'timeline', label: 'Updates / Timeline' },
  { id: 'materials', label: 'Materials' },
  { id: 'attachments', label: 'Execution / Evidence / Report' },
  { id: 'documents', label: 'Documents' },
  { id: 'checklist', label: 'PM Checklist' },
  { id: 'audit', label: 'Audit Trail' },
]

const emptyPayload: WorkOrderDetailPayload = {
  workOrder: null,
  execution: null,
  materials: [],
  technicians: [],
  materialRequests: [],
  events: [],
  assignmentHistory: [],
  assignmentGroups: [],
  pmTemplates: [],
}

export function WorkOrderDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { session } = useAuth()
  const { pushToast } = useToast()
  const [materialsOpen, setMaterialsOpen] = useState(false)
  const [completionNotes, setCompletionNotes] = useState('')
  const [ackName, setAckName] = useState('')
  const [ackComments, setAckComments] = useState('')
  const [commentDraft, setCommentDraft] = useState('')
  const [materialLine, setMaterialLine] = useState({ materialItemId: '', quantityRequested: 1 })
  const [assignmentModal, setAssignmentModal] = useState<'group' | 'technicians' | 'reassign' | 'response' | 'arrival' | 'departure' | null>(null)
  const [assignmentGroupId, setAssignmentGroupId] = useState('')
  const [selectedTechnicianIds, setSelectedTechnicianIds] = useState<string[]>([])
  const [leadTechnicianId, setLeadTechnicianId] = useState('')
  const [assignmentNotes, setAssignmentNotes] = useState('')
  const [groupMembers, setGroupMembers] = useState<AssignmentGroupRecord['members']>([])
  const [groupMembersLoading, setGroupMembersLoading] = useState(false)
  const [groupMembersError, setGroupMembersError] = useState('')
  const [responseTechnicianId, setResponseTechnicianId] = useState('')
  const [responseValue, setResponseValue] = useState<'Accepted' | 'Declined'>('Accepted')
  const [presenceTechnicianId, setPresenceTechnicianId] = useState('')
  const [activeTab, setActiveTab] = useState<DetailTab>('overview')
  const [attachTemplateOpen, setAttachTemplateOpen] = useState(false)
  const [selectedPmTemplateId, setSelectedPmTemplateId] = useState('')
  const [checklistDrafts, setChecklistDrafts] = useState<Record<string, ChecklistDraft>>({})
  const [savingChecklistItemId, setSavingChecklistItemId] = useState<string | null>(null)
  const [attachingTemplate, setAttachingTemplate] = useState(false)
  const [kipOpen, setKipOpen] = useState(false)
  const [woAttachments, setWoAttachments] = useState<AttachmentRecord[]>([])
  const [knowledgeSuggestions, setKnowledgeSuggestions] = useState<KnowledgeArticleListItem[]>([])
  const [knowledgeLoading, setKnowledgeLoading] = useState(false)
  const [draftingKnowledge, setDraftingKnowledge] = useState(false)

  const { data, loading, error, reload } = useAsyncData<WorkOrderDetailPayload>(
    async (signal) => {
      const workOrder = await workOrderService.get(id, signal)
      const [execution, materials, technicians, materialRequests, events, assignmentHistory, assignmentGroups, pmTemplates] = await Promise.all([
        workOrderService.getExecution(workOrder.id, signal),
        materialService.list({ branchId: workOrder.branchId, signal }),
        technicianService.list(workOrder.branchId, signal),
        workOrderService.listMaterialRequests(workOrder.branchId, signal),
        workOrderService.getEvents(workOrder.id, signal),
        workOrderService.getAssignmentHistory(workOrder.id, signal),
        settingsService.listAssignmentGroups(signal),
        pmTemplateService.list(signal),
      ])

      return {
        workOrder,
        execution,
        materials,
        technicians,
        materialRequests: materialRequests.filter((request) => request.workOrderId === workOrder.id),
        events,
        assignmentHistory,
        assignmentGroups: assignmentGroups.filter((group) => !group.branchId || group.branchId === workOrder.branchId),
        pmTemplates: pmTemplates.filter((template) => template.isActive),
      }
    },
    emptyPayload,
    [id],
  )

  const selectedMaterial = useMemo(
    () => data.materials.find((item) => item.id === materialLine.materialItemId) ?? null,
    [data.materials, materialLine.materialItemId],
  )

  const selectedGroup = useMemo(
    () => data.assignmentGroups.find((group) => group.id === assignmentGroupId) ?? null,
    [assignmentGroupId, data.assignmentGroups],
  )

  useEffect(() => {
    if (!assignmentGroupId || !['technicians', 'reassign'].includes(assignmentModal ?? '')) {
      setGroupMembers([])
      setGroupMembersError('')
      setGroupMembersLoading(false)
      return
    }

    let active = true
    setGroupMembersLoading(true)
    setGroupMembersError('')

    settingsService.getAssignmentGroupMembers(assignmentGroupId)
      .then((members) => {
        if (!active) return
        setGroupMembers(members.filter((member) => member.isActive))
      })
      .catch((nextError) => {
        if (!active) return
        setGroupMembers([])
        setGroupMembersError(nextError instanceof Error ? nextError.message : 'Unable to load assignment group members.')
      })
      .finally(() => {
        if (active) {
          setGroupMembersLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [assignmentGroupId, assignmentModal])

  useEffect(() => {
    const items = data.workOrder?.checklistItems ?? []
    setChecklistDrafts(
      Object.fromEntries(
        items.map((item) => [
          item.id,
          {
            responseValue: item.responseValue ?? '',
            remarks: item.remarks ?? '',
            isCompleted: item.isCompleted,
          },
        ]),
      ),
    )
    setSelectedPmTemplateId(data.workOrder?.pmTemplateId ?? '')
  }, [data.workOrder])

  useEffect(() => {
    if (!id || activeTab !== 'documents') return
    let active = true
    attachmentService.list(ATTACHMENT_ENTITY_TYPES.WorkOrder, id)
      .then((result) => { if (active) setWoAttachments(result) })
      .catch(() => { if (active) setWoAttachments([]) })
    return () => { active = false }
  }, [id, activeTab])

  useEffect(() => {
    if (!id) return
    let active = true
    setKnowledgeLoading(true)
    knowledgeService.getSuggestionsForWorkOrder(id)
      .then((result) => {
        if (active) {
          setKnowledgeSuggestions(result)
        }
      })
      .catch(() => {
        if (active) {
          setKnowledgeSuggestions([])
        }
      })
      .finally(() => {
        if (active) {
          setKnowledgeLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [id])

  async function getCurrentPosition() {
    if (!('geolocation' in navigator)) {
      return { latitude: null, longitude: null }
    }

    return new Promise<{ latitude: number | null; longitude: number | null }>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
        () => resolve({ latitude: null, longitude: null }),
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 60000 },
      )
    })
  }

  if (loading) {
    return <LoadingState label="Loading work order details" />
  }

  if (error) {
    return <ErrorState title="Unable to load work order" description={error} />
  }

  if (!data.workOrder) {
    return <EmptyState title="Work order not found" description="The requested work order is no longer available." actionLabel="Back to list" onAction={() => navigate('/work-orders')} />
  }

  const workOrder = data.workOrder
  const assignedGroupLabel = resolveAssignedGroupName(workOrder)
  const assignedToLabel = resolveAssignedToName(workOrder)
  const locationLabel = workOrder.siteName || workOrder.branchName || workOrder.assetName || 'No site linked'
  const activityFeed = buildTimelineEntries(data.assignmentHistory, data.events)
  const latestUpdate = activityFeed[0] ?? null
  const checklistItems = workOrder.checklistItems ?? []
  const checklistSections = groupChecklistItems(checklistItems)
  const canAttachTemplate = Boolean(workOrder.isPreventiveMaintenance && (session?.role === 'admin' || session?.permissions?.canCreateWorkOrders))
  const trackingSummary = [
    { label: 'Created', value: formatDateTime(workOrder.createdAt) },
    { label: 'Started', value: formatDateTime(workOrder.workStartedAt || undefined) },
    { label: 'Arrived', value: formatDateTime(workOrder.arrivalAt || undefined) },
    { label: 'Departed', value: formatDateTime(workOrder.departureAt || undefined) },
  ]
  const completedChecklistCount = checklistItems.filter((item) => item.isCompleted).length
  const openMaterialRequests = data.materialRequests.filter((request) => !stringEquals(request.status, 'Closed')).length
  const kipContext = {
    screen: 'work-order-detail',
    entityType: 'WorkOrder',
    entityId: workOrder.id,
    entitySummary: {
      workOrderNumber: workOrder.workOrderNumber,
      title: workOrder.title,
      status: workOrder.status,
      priority: workOrder.priority,
      clientName: workOrder.clientName,
      slaStatus: workOrder.slaStatus,
    },
    tenantId: session?.tenantId || '',
    userId: session?.userId || '',
    userRole: session?.role || 'unknown',
    timestamp: new Date().toISOString(),
  }

  async function updateStatus(status: string) {
    try {
      await workOrderService.updateStatus(workOrder, status)
      pushToast({ title: 'Status updated', description: `Work order moved to ${status}.`, tone: 'success' })
      await reload()
    } catch (nextError) {
      pushToast({ title: 'Update failed', description: nextError instanceof Error ? nextError.message : 'Unable to update status.', tone: 'danger' })
    }
  }

  async function startWorkOrder() {
    try {
      await workOrderService.start(workOrder.id)
      pushToast({ title: 'Work started', description: 'The work order is now in progress.', tone: 'success' })
      await reload()
    } catch (nextError) {
      pushToast({ title: 'Start failed', description: nextError instanceof Error ? nextError.message : 'Unable to start the work order.', tone: 'danger' })
    }
  }

  async function submitGroupAssignment(mode: 'group' | 'reassign') {
    try {
      if (mode === 'group') {
        await workOrderService.assignGroup(workOrder.id, { assignmentGroupId: assignmentGroupId || null, notes: assignmentNotes || null })
      } else {
        await workOrderService.reassign(workOrder.id, { assignmentGroupId: assignmentGroupId || null, technicianIds: selectedTechnicianIds, leadTechnicianId: leadTechnicianId || null, notes: assignmentNotes || null })
      }
      pushToast({ title: 'Assignment updated', description: 'The assignment was saved successfully.', tone: 'success' })
      await reload()
      setAssignmentModal(mode === 'group' && assignmentGroupId ? 'technicians' : null)
    } catch (nextError) {
      pushToast({ title: 'Assignment failed', description: nextError instanceof Error ? nextError.message : 'Unable to save assignment.', tone: 'danger' })
    }
  }

  async function submitTechnicianAssignment(mode: 'technicians' | 'reassign') {
    try {
      if (mode === 'technicians') {
        await workOrderService.assignTechnicians(workOrder.id, { technicianIds: selectedTechnicianIds, leadTechnicianId: leadTechnicianId || null, notes: assignmentNotes || null })
      } else {
        await workOrderService.reassign(workOrder.id, { assignmentGroupId: assignmentGroupId || null, technicianIds: selectedTechnicianIds, leadTechnicianId: leadTechnicianId || null, notes: assignmentNotes || null })
      }
      pushToast({ title: 'Technicians assigned', description: 'Technician assignment has been updated.', tone: 'success' })
      setAssignmentModal(null)
      await reload()
    } catch (nextError) {
      pushToast({ title: 'Assignment failed', description: nextError instanceof Error ? nextError.message : 'Unable to update technician assignment.', tone: 'danger' })
    }
  }

  async function requestMaterials() {
    if (!materialLine.materialItemId || materialLine.quantityRequested <= 0) {
      pushToast({ title: 'Missing material line', description: 'Choose a material item and quantity first.', tone: 'warning' })
      return
    }

    try {
      await workOrderService.requestMaterials(workOrder.id, [materialLine])
      pushToast({ title: 'Material request created', description: 'The request has been linked to this work order.', tone: 'success' })
      setMaterialsOpen(false)
      setMaterialLine({ materialItemId: '', quantityRequested: 1 })
      await reload()
    } catch (nextError) {
      pushToast({ title: 'Request failed', description: nextError instanceof Error ? nextError.message : 'Unable to request materials.', tone: 'danger' })
    }
  }

  async function addComment() {
    if (!commentDraft.trim()) return

    try {
      await workOrderService.addComment(workOrder.id, commentDraft.trim())
      pushToast({ title: 'Update saved', description: 'The work order timeline has been refreshed.', tone: 'success' })
      setCommentDraft('')
      await reload()
    } catch (nextError) {
      pushToast({ title: 'Save failed', description: nextError instanceof Error ? nextError.message : 'Unable to save the update.', tone: 'danger' })
    }
  }

  async function completeWorkOrder() {
    if (!completionNotes.trim()) {
      pushToast({ title: 'Report required', description: 'Enter the work done notes before completing the job.', tone: 'warning' })
      return
    }

    try {
      await workOrderService.complete(workOrder.id, {
        workDoneNotes: completionNotes.trim(),
        technicianId: workOrder.leadTechnicianId || workOrder.assignedTechnicianId || null,
        assignmentGroupId: assignmentGroupId || workOrder.assignmentGroupId || null,
        reportSummary: completionNotes.trim(),
      })
      pushToast({ title: 'Work order completed', description: 'The completion report has been submitted.', tone: 'success' })
      await reload()
    } catch (nextError) {
      pushToast({ title: 'Completion failed', description: nextError instanceof Error ? nextError.message : 'Unable to complete work order.', tone: 'danger' })
    }
  }

  async function acknowledgeWorkOrder() {
    if (!ackName.trim()) {
      pushToast({ title: 'Acknowledgement required', description: 'Enter the client name for acknowledgement.', tone: 'warning' })
      return
    }

    try {
      await workOrderService.acknowledge(workOrder.id, {
        acknowledgedByName: ackName.trim(),
        comments: ackComments.trim() || null,
      })
      pushToast({ title: 'Work order closed', description: 'Client acknowledgement has been recorded and the work order is now closed.', tone: 'success' })
      await reload()
    } catch (nextError) {
      pushToast({ title: 'Acknowledgement failed', description: nextError instanceof Error ? nextError.message : 'Unable to acknowledge work order.', tone: 'danger' })
    }
  }

  async function draftKnowledgeArticle() {
    setDraftingKnowledge(true)
    try {
      const article = await knowledgeService.draftFromWorkOrder(workOrder.id)
      pushToast({ title: 'Draft article created', description: 'A knowledge draft was generated from the completed work order.', tone: 'success' })
      navigate(`/knowledge/${article.id}/edit`)
    } catch (nextError) {
      pushToast({ title: 'Draft failed', description: nextError instanceof Error ? nextError.message : 'Unable to draft knowledge article.', tone: 'danger' })
    } finally {
      setDraftingKnowledge(false)
    }
  }

  async function submitTechnicianResponse() {
    if (!responseTechnicianId) {
      pushToast({ title: 'Technician required', description: 'Select a technician first.', tone: 'warning' })
      return
    }

    try {
      await workOrderService.technicianResponse(workOrder.id, { technicianId: responseTechnicianId, response: responseValue, notes: assignmentNotes || null })
      pushToast({ title: 'Response saved', description: 'Technician response has been recorded.', tone: 'success' })
      setAssignmentModal(null)
      await reload()
    } catch (nextError) {
      pushToast({ title: 'Response failed', description: nextError instanceof Error ? nextError.message : 'Unable to save technician response.', tone: 'danger' })
    }
  }

  async function recordLocation(kind: 'arrival' | 'departure') {
    if (!presenceTechnicianId) {
      pushToast({ title: 'Technician required', description: 'Select a technician first.', tone: 'warning' })
      return
    }

    const position = await getCurrentPosition()

    try {
      if (kind === 'arrival') {
        await workOrderService.recordArrival(workOrder.id, { technicianId: presenceTechnicianId, ...position, arrivedAt: new Date().toISOString() })
        pushToast({ title: 'Arrival recorded', description: 'Arrival time and location were saved.', tone: 'success' })
      } else {
        await workOrderService.recordDeparture(workOrder.id, { technicianId: presenceTechnicianId, ...position, departedAt: new Date().toISOString() })
        pushToast({ title: 'Departure recorded', description: 'Departure time and location were saved.', tone: 'success' })
      }
      setAssignmentModal(null)
      await reload()
    } catch (nextError) {
      pushToast({ title: `${kind === 'arrival' ? 'Arrival' : 'Departure'} failed`, description: nextError instanceof Error ? nextError.message : 'Unable to save technician tracking.', tone: 'danger' })
    }
  }

  function openAssignmentWizard() {
    setAssignmentGroupId(workOrder.assignmentGroupId || '')
    setSelectedTechnicianIds(workOrder.technicianAssignments?.map((assignment) => assignment.technicianId) || [])
    setLeadTechnicianId(workOrder.leadTechnicianId || '')
    setAssignmentNotes(workOrder.assignmentNotes || '')
    setAssignmentModal(workOrder.assignmentGroupId ? 'reassign' : 'group')
  }

  function openTechnicianResponse() {
    setResponseTechnicianId(workOrder.leadTechnicianId || workOrder.assignedTechnicianId || '')
    setResponseValue('Accepted')
    setAssignmentNotes('')
    setAssignmentModal('response')
  }

  function openPresenceModal(kind: 'arrival' | 'departure') {
    setPresenceTechnicianId(workOrder.leadTechnicianId || workOrder.assignedTechnicianId || '')
    setAssignmentModal(kind)
  }

  async function saveChecklistItem(item: WorkOrderChecklistItemRecord) {
    const draft = checklistDrafts[item.id]
    if (!draft) {
      return
    }

    setSavingChecklistItemId(item.id)
    try {
      await workOrderService.updateChecklistItem(workOrder.id, item.id, {
        responseValue: draft.responseValue || null,
        remarks: draft.remarks || null,
        isCompleted: draft.isCompleted,
      })
      pushToast({ title: 'Checklist updated', description: 'The checklist item was saved successfully.', tone: 'success' })
      await reload()
    } catch (nextError) {
      pushToast({ title: 'Checklist update failed', description: nextError instanceof Error ? nextError.message : 'Unable to save checklist item.', tone: 'danger' })
    } finally {
      setSavingChecklistItemId(null)
    }
  }

  async function attachTemplate() {
    if (!selectedPmTemplateId) {
      pushToast({ title: 'PM template required', description: 'Select a PM template first.', tone: 'warning' })
      return
    }

    setAttachingTemplate(true)
    try {
      await workOrderService.attachPmTemplate(workOrder.id, selectedPmTemplateId)
      pushToast({ title: 'Template attached', description: 'The PM checklist has been attached to this work order.', tone: 'success' })
      setAttachTemplateOpen(false)
      await reload()
    } catch (nextError) {
      pushToast({ title: 'Attach failed', description: nextError instanceof Error ? nextError.message : 'Unable to attach PM template.', tone: 'danger' })
    } finally {
      setAttachingTemplate(false)
    }
  }

  return (
    <>
      <PageScaffold
        eyebrow="Operations"
        title={workOrder.clientName || 'Client not set'}
        description={`${workOrder.workOrderNumber} · ${workOrder.title}`}
        actions={(
          <>
            <button type="button" className="button-secondary w-full sm:w-auto" onClick={() => navigate('/work-orders')}>
              <ArrowLeft className="h-4 w-4" />
              Back to work orders
            </button>
            <button type="button" className="button-secondary w-full sm:w-auto" onClick={openAssignmentWizard}>
              {workOrder.assignmentGroupId || workOrder.technicianAssignments?.length ? 'Reassign' : 'Assign'}
            </button>
            <button type="button" className="button-secondary w-full sm:w-auto" onClick={() => setMaterialsOpen(true)}>
              <PackagePlus className="h-4 w-4" />
              Request Materials
            </button>
            <button type="button" className="button-secondary w-full sm:w-auto" disabled={!stringEquals(workOrder.status, 'Completed')} onClick={() => void acknowledgeWorkOrder()}>
              Close Work Order
            </button>
          </>
        )}
      >
        <SectionCard title="Work order command centre" description={locationLabel}>
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <InlineMeta label="Priority" value={<Badge tone={priorityTone(workOrder.priority as 'Critical' | 'High' | 'Medium' | 'Low')}>{workOrder.priority}</Badge>} />
              <InlineMeta label="Status" value={<Badge tone={statusTone(workOrder.status as never)}>{workOrder.status}</Badge>} />
              <InlineMeta label="Group" value={assignedGroupLabel} />
              <InlineMeta label="Assigned to" value={assignedToLabel} />
              <InlineMeta label="Due" value={formatDateOnly(workOrder.dueDate || undefined)} />
              <InlineMeta label="Created" value={formatDateOnly(workOrder.createdAt)} />
            </div>

            <MetricGrid className="xl:grid-cols-4">
              <MetricCard label="Assignment" value={assignedToLabel} meta={assignedGroupLabel} emphasis="accent" />
              <MetricCard label="Checklist" value={workOrder.isPreventiveMaintenance ? `${completedChecklistCount}/${checklistItems.length}` : 'N/A'} meta={workOrder.pmTemplateName || 'No PM template linked'} />
              <MetricCard label="Materials open" value={openMaterialRequests} meta={`${data.materialRequests.length} requests linked`} emphasis={openMaterialRequests > 0 ? 'warning' : 'default'} />
              <MetricCard label="Latest update" value={latestUpdate ? formatDateTime(latestUpdate.when) : 'No updates'} meta={latestUpdate?.title || 'Timeline is quiet'} />
            </MetricGrid>
          </div>
        </SectionCard>

        <SectionCard title="Work order detail" description="Track execution, field notes, materials, PM checklist progress, and audit events.">
          <div className="space-y-4">
            <PageTabs tabs={detailTabs} activeTab={activeTab} onChange={setActiveTab} />

            {activeTab === 'overview' ? (
              <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
                <div className="space-y-4">
                  <Block title="Work description">
                    <p className="text-sm leading-6 text-muted">{workOrder.description || 'No work description has been provided.'}</p>
                  </Block>

                  <Block title="Latest technician update">
                    {latestUpdate ? <TimelineCard entry={latestUpdate} /> : <EmptyPanel message="No updates have been added yet." />}
                  </Block>

                  <Block title="Timeline snapshot">
                    {activityFeed.length === 0 ? (
                      <EmptyPanel message="No timeline activity has been recorded yet." />
                    ) : (
                      <div className="space-y-3">
                        {activityFeed.slice(0, 4).map((entry) => (
                          <TimelineCard key={entry.id} entry={entry} compact />
                        ))}
                      </div>
                    )}
                  </Block>

                  <Block title="Add update">
                    <textarea
                      value={commentDraft}
                      onChange={(event) => setCommentDraft(event.target.value)}
                      className="field-input min-h-[140px]"
                      placeholder="Add work update, findings, or action taken..."
                    />
                    <StickyActionFooter>
                      <button type="button" className="button-primary w-full sm:w-auto" disabled={!commentDraft.trim()} onClick={() => void addComment()}>
                        <MessageSquarePlus className="h-4 w-4" />
                        Save update
                      </button>
                    </StickyActionFooter>
                  </Block>
                </div>

                <div className="space-y-4">
                  <Block title="Assignment details">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <KeyValue label="Assigned group" value={assignedGroupLabel} />
                      <KeyValue label="Assigned to" value={assignedToLabel} />
                      <KeyValue label="Lead technician" value={workOrder.leadTechnicianName || 'Not selected'} />
                      <KeyValue label="Assignment type" value={workOrder.assignmentType || 'Not set'} />
                    </div>
                    {workOrder.technicianAssignments?.length ? (
                      <div className="flex flex-wrap gap-2">
                        {workOrder.technicianAssignments.map((assignment) => (
                          <Badge key={assignment.id} tone={assignment.isLead ? 'info' : 'neutral'}>
                            {assignment.technicianName || 'Technician'} {assignment.isLead ? '| Lead' : ''} {assignment.status ? `| ${assignment.status}` : ''}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <EmptyPanel message="No technicians are assigned yet." />
                    )}
                    {workOrder.assignmentNotes ? (
                      <div className="panel-subtle rounded-2xl p-4 text-sm text-muted">
                        <span className="font-medium text-app">Notes:</span> {workOrder.assignmentNotes}
                      </div>
                    ) : null}
                    <div className="flex flex-wrap gap-2">
                      <button type="button" className="button-secondary" onClick={openAssignmentWizard}>
                        {workOrder.assignmentGroupId || workOrder.technicianAssignments?.length ? 'Reassign work order' : 'Assign work order'}
                      </button>
                      <button type="button" className="button-secondary" onClick={openTechnicianResponse}>
                        Record technician response
                      </button>
                    </div>
                  </Block>

                  <Block title="SLA & status">
                    <Field label="Work status">
                      <select className="field-input" value={workOrder.status} onChange={(event) => void updateStatus(event.target.value)}>
                        {['Open', 'In Progress', 'Awaiting Parts', 'Awaiting Client', 'Cancelled'].map((item) => (
                          <option key={item} value={item}>{item}</option>
                        ))}
                      </select>
                    </Field>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <KeyValue label="SLA status" value={<Badge tone={(workOrder.slaResponseBreached || workOrder.slaResolutionBreached) ? 'danger' : workOrder.slaResolutionDeadline ? 'success' : 'neutral'}>{workOrder.slaStatus}</Badge>} />
                      <KeyValue label="Due date" value={formatDateOnly(workOrder.dueDate || undefined)} />
                      <KeyValue label="Response SLA" value={formatDateTime(workOrder.slaResponseDeadline || undefined)} />
                      <KeyValue label="Resolution SLA" value={formatDateTime(workOrder.slaResolutionDeadline || undefined)} />
                      <KeyValue label="Created date" value={formatDateTime(workOrder.createdAt)} />
                      <KeyValue label="Started" value={formatDateTime(workOrder.workStartedAt || undefined)} />
                      <KeyValue label="Completed" value={formatDateTime(workOrder.completedAt || undefined)} />
                    </div>
                  </Block>

                  <Block title="Client & asset">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <KeyValue label="Client" value={workOrder.clientName || 'Not set'} />
                      <KeyValue label="Site / branch" value={workOrder.siteName || workOrder.branchName || 'Not set'} />
                      <KeyValue label="Asset" value={workOrder.assetName || 'No linked asset'} />
                      <KeyValue label="Work order" value={workOrder.workOrderNumber} />
                    </div>
                    {!workOrder.assetId ? (
                      <div className="mt-3 rounded-2xl border border-app bg-[var(--app-surface)] px-4 py-3 text-sm text-muted">
                        This work order is not linked to a registered asset.
                      </div>
                    ) : null}
                  </Block>

                  <Block title="Suggested knowledge">
                    {knowledgeLoading ? (
                      <EmptyPanel message="Loading related guides..." />
                    ) : knowledgeSuggestions.length === 0 ? (
                      <EmptyPanel message="No suggested guides yet. Publish an article or draft one from this work order." />
                    ) : (
                      <div className="space-y-3">
                        {knowledgeSuggestions.map((article) => (
                          <button
                            key={article.id}
                            type="button"
                            className="w-full rounded-2xl border border-app bg-[var(--app-surface)] px-4 py-3 text-left"
                            onClick={() => navigate(`/knowledge/${article.id}`)}
                          >
                            <p className="text-sm font-semibold text-app">{article.title}</p>
                            <p className="mt-2 text-sm text-muted">{article.summary || 'Open this guide to review the troubleshooting steps.'}</p>
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <button type="button" className="button-secondary" onClick={() => navigate('/knowledge')}>
                        Open library
                      </button>
                      <button
                        type="button"
                        className="button-primary"
                        disabled={draftingKnowledge || !stringEquals(workOrder.status, 'Completed')}
                        onClick={() => void draftKnowledgeArticle()}
                      >
                        {draftingKnowledge ? 'Drafting...' : 'Draft from work order'}
                      </button>
                    </div>
                  </Block>

                  <Block title="Quick actions">
                    <div className="flex flex-wrap gap-2">
                      <button type="button" className="button-secondary" onClick={() => void startWorkOrder()}>
                        <Play className="h-4 w-4" />
                        Start Job
                      </button>
                      <button type="button" className="button-secondary" onClick={() => openPresenceModal('arrival')}>
                        <ClipboardCheck className="h-4 w-4" />
                        Record Arrival
                      </button>
                      <button type="button" className="button-secondary" onClick={() => openPresenceModal('departure')}>
                        <Square className="h-4 w-4" />
                        Record Departure
                      </button>
                      <button type="button" className="button-secondary" onClick={() => setMaterialsOpen(true)}>
                        <PackagePlus className="h-4 w-4" />
                        Request Materials
                      </button>
                    </div>
                  </Block>

                  <Block title="Complete work order">
                    <textarea
                      value={completionNotes}
                      onChange={(event) => setCompletionNotes(event.target.value)}
                      className="field-input min-h-[140px]"
                      placeholder="Describe the work done, findings, materials used, and follow-up actions."
                    />
                    <StickyActionFooter>
                      <button type="button" className="button-primary w-full sm:w-auto" onClick={() => void completeWorkOrder()}>
                        <CheckCircle2 className="h-4 w-4" />
                        Complete work order
                      </button>
                    </StickyActionFooter>
                  </Block>

                  <Block title="Close work order">
                    <Field label="Acknowledged by">
                      <input value={ackName} onChange={(event) => setAckName(event.target.value)} className="field-input" />
                    </Field>
                    <Field label="Comments">
                      <textarea value={ackComments} onChange={(event) => setAckComments(event.target.value)} className="field-input min-h-[110px]" />
                    </Field>
                    <StickyActionFooter>
                      <button type="button" className="button-primary w-full sm:w-auto" disabled={!stringEquals(workOrder.status, 'Completed') || !ackName.trim()} onClick={() => void acknowledgeWorkOrder()}>
                        Close work order
                      </button>
                    </StickyActionFooter>
                    {workOrder.acknowledgedByName ? (
                      <div className="panel-subtle rounded-2xl p-4 text-sm text-muted">
                        Last sign-off: <span className="text-app">{workOrder.acknowledgedByName}</span> on <span className="text-app">{formatDateTime(workOrder.acknowledgementDate || undefined)}</span>
                      </div>
                    ) : null}
                  </Block>
                </div>
              </div>
            ) : null}

          {activeTab === 'timeline' ? (
            <Block title="Updates / Timeline">
              {activityFeed.length === 0 ? (
                <EmptyPanel message="No updates have been recorded yet." />
              ) : (
                <div className="space-y-3">
                  {activityFeed.map((entry) => (
                    <TimelineCard key={entry.id} entry={entry} />
                  ))}
                </div>
              )}
            </Block>
          ) : null}

          {activeTab === 'materials' ? (
            <Block title="Materials">
              <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                <button type="button" className="button-secondary w-full sm:w-auto" onClick={() => setMaterialsOpen(true)}>
                  <PackagePlus className="h-4 w-4" />
                  Request Materials
                </button>
              </div>
              {data.materialRequests.length === 0 ? (
                <EmptyPanel message="No material requests have been raised for this work order yet." />
              ) : (
                <div className="space-y-3">
                  {data.materialRequests.map((request) => (
                    <div key={request.id} className="panel-subtle rounded-2xl p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-app">{request.requestNumber}</p>
                          <p className="mt-1 text-xs text-muted">{request.requestedByName || 'System'} | {formatDateTime(request.createdAt)}</p>
                        </div>
                        <Badge tone={request.status === 'Issued' ? 'success' : request.status === 'Approved' ? 'info' : 'warning'}>{request.status}</Badge>
                      </div>
                      <div className="mt-3 space-y-2">
                        {request.lines.map((line) => (
                          <div key={line.id} className="rounded-2xl border border-app px-3 py-2 text-sm text-muted">
                            <span className="font-medium text-app">{line.itemName || line.itemCode || 'Material'}</span>
                            <span> | requested {line.quantityRequested}</span>
                            <span> | issued {line.quantityIssued}</span>
                            <span> | used {line.quantityUsed}</span>
                            <span> | returned {line.quantityReturned}</span>
                          </div>
                        ))}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {request.status === 'Pending' && session?.permissions?.canApproveMaterials ? (
                          <button
                            type="button"
                            className="button-secondary"
                            onClick={async () => {
                              try {
                                await workOrderService.approveMaterialRequest(request.id)
                                pushToast({ title: 'Request approved', description: 'Material request approved successfully.', tone: 'success' })
                                await reload()
                              } catch (nextError) {
                                pushToast({ title: 'Approval failed', description: nextError instanceof Error ? nextError.message : 'Unable to approve request.', tone: 'danger' })
                              }
                            }}
                          >
                            Approve
                          </button>
                        ) : null}
                        {request.status === 'Approved' && session?.permissions?.canIssueMaterials ? (
                          <button
                            type="button"
                            className="button-secondary"
                            onClick={async () => {
                              try {
                                await workOrderService.issueMaterialRequest(
                                  request.id,
                                  request.lines.map((line) => ({
                                    materialRequestLineId: line.id,
                                    quantityIssued: Math.max(line.quantityRequested - line.quantityIssued, 0),
                                  })),
                                )
                                pushToast({ title: 'Materials issued', description: 'Stock has been issued successfully.', tone: 'success' })
                                await reload()
                              } catch (nextError) {
                                pushToast({ title: 'Issue failed', description: nextError instanceof Error ? nextError.message : 'Unable to issue stock.', tone: 'danger' })
                              }
                            }}
                          >
                            Issue Stock
                          </button>
                        ) : null}
                        {request.status === 'Issued' ? (
                          <button
                            type="button"
                            className="button-secondary"
                            onClick={async () => {
                              try {
                                await workOrderService.closeMaterialRequest(
                                  request.id,
                                  request.lines.map((line) => ({
                                    materialRequestLineId: line.id,
                                    quantityUsed: line.quantityIssued,
                                    quantityReturned: 0,
                                  })),
                                )
                                pushToast({ title: 'Material usage recorded', description: 'The work order usage has been closed out.', tone: 'success' })
                                await reload()
                              } catch (nextError) {
                                pushToast({ title: 'Close failed', description: nextError instanceof Error ? nextError.message : 'Unable to close material request.', tone: 'danger' })
                              }
                            }}
                          >
                            Record Usage
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Block>
          ) : null}

          {activeTab === 'attachments' ? (
            <Block title="Execution / Evidence / Report">
              <WorkOrderExecutionWorkspace
                workOrder={workOrder}
                execution={data.execution}
                materials={data.materials}
                onReload={reload}
                pushToast={pushToast}
              />
            </Block>
          ) : null}

          {activeTab === 'documents' ? (
            <Block title="Documents & Attachments">
              <AttachmentPanel
                entityType={ATTACHMENT_ENTITY_TYPES.WorkOrder}
                entityId={id}
                attachments={woAttachments}
                onUploaded={(a) => setWoAttachments((prev) => [...prev, a])}
                onDeleted={(deletedId) => setWoAttachments((prev) => prev.filter((a) => a.id !== deletedId))}
              />
            </Block>
          ) : null}

          {activeTab === 'checklist' ? (
            <Block title="PM Checklist">
              {!workOrder.isPreventiveMaintenance ? (
                <EmptyPanel message="Checklist is available for preventive maintenance work orders." />
              ) : checklistItems.length === 0 ? (
                <div className="space-y-3">
                  <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
                    No PM checklist is attached to this work order.
                  </div>
                  {canAttachTemplate ? (
                    <div className="flex justify-end">
                      <button type="button" className="button-secondary" onClick={() => setAttachTemplateOpen(true)}>
                        Attach Template
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <KeyValue label="Template" value={workOrder.pmTemplateName || 'Attached checklist'} />
                    <KeyValue label="Latest report notes" value={workOrder.workDoneNotes || 'No PM completion notes have been submitted yet.'} />
                  </div>
                  {checklistSections.map((section) => (
                    <div key={section.name} className="space-y-3 rounded-2xl border border-app p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-base font-semibold text-app">{section.name}</p>
                        <Badge tone="info">{section.items.length} items</Badge>
                      </div>
                      <div className="space-y-3">
                        {section.items.map((item) => {
                          const draft = checklistDrafts[item.id] ?? { responseValue: '', remarks: '', isCompleted: false }
                          return (
                            <div key={item.id} className="panel-subtle rounded-2xl p-4">
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="space-y-2">
                                  <p className="font-medium text-app">{item.questionText}</p>
                                  <div className="flex flex-wrap gap-2">
                                    <Badge tone="neutral">{item.inputType}</Badge>
                                    {item.isRequired ? <Badge tone="warning">Required</Badge> : null}
                                    {draft.isCompleted ? <Badge tone="success">Completed</Badge> : <Badge tone="neutral">Open</Badge>}
                                  </div>
                                </div>
                              </div>
                              <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
                                <Field label="Response">
                                  {renderChecklistInput(item, draft, (value) =>
                                    setChecklistDrafts((current) => ({
                                      ...current,
                                      [item.id]: { ...draft, responseValue: value },
                                    })))}
                                </Field>
                                <label className="panel-subtle mt-7 flex items-center justify-between rounded-2xl px-4 py-3">
                                  <span className="text-sm text-app">Completed</span>
                                  <input
                                    type="checkbox"
                                    checked={draft.isCompleted}
                                    onChange={(event) =>
                                      setChecklistDrafts((current) => ({
                                        ...current,
                                        [item.id]: { ...draft, isCompleted: event.target.checked },
                                      }))}
                                  />
                                </label>
                              </div>
                              <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto]">
                                <Field label="Remarks">
                                  <textarea
                                    value={draft.remarks}
                                    onChange={(event) =>
                                      setChecklistDrafts((current) => ({
                                        ...current,
                                        [item.id]: { ...draft, remarks: event.target.value },
                                      }))}
                                    className="field-input min-h-[96px]"
                                  />
                                </Field>
                                <div className="mt-7 flex items-end">
                                  <button type="button" className="button-primary" disabled={savingChecklistItemId === item.id} onClick={() => void saveChecklistItem(item)}>
                                    {savingChecklistItemId === item.id ? 'Saving...' : 'Save item'}
                                  </button>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Block>
          ) : null}

          {activeTab === 'audit' ? (
            <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
              <Block title="Audit Trail">
                {activityFeed.length === 0 ? (
                  <EmptyPanel message="No audit entries are available yet." />
                ) : (
                  <div className="space-y-3">
                    {activityFeed.map((entry) => (
                      <TimelineCard key={entry.id} entry={entry} compact />
                    ))}
                  </div>
                )}
              </Block>

              <Block title="Tracking summary">
                <div className="grid gap-3 sm:grid-cols-2">
                  {trackingSummary.map((item) => (
                    <KeyValue key={item.label} label={item.label} value={item.value} />
                  ))}
                </div>
              </Block>
            </div>
          ) : null}
          </div>
        </SectionCard>
      </PageScaffold>

      <KipButton onClick={() => setKipOpen(true)} />
      <KipPanel open={kipOpen} onClose={() => setKipOpen(false)} title={`KIP • ${workOrder.workOrderNumber}`} context={kipContext} />

      <Modal open={assignmentModal === 'group'} title="Select assignment group" description="Choose the group that should own this work order." onClose={() => setAssignmentModal(null)}>
        <div className="space-y-4">
          <Field label="Assignment group">
            <select value={assignmentGroupId} onChange={(event) => setAssignmentGroupId(event.target.value)} className="field-input">
              <option value="">Select assignment group</option>
              {data.assignmentGroups.map((group) => (
                <option key={group.id} value={group.id}>{group.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Notes">
            <textarea value={assignmentNotes} onChange={(event) => setAssignmentNotes(event.target.value)} className="field-input min-h-[100px]" />
          </Field>
          <div className="flex justify-end gap-3">
            <button type="button" className="button-secondary" onClick={() => setAssignmentModal(null)}>Cancel</button>
            <button type="button" className="button-primary" disabled={!assignmentGroupId} onClick={() => void submitGroupAssignment('group')}>Continue</button>
          </div>
        </div>
      </Modal>

      <Modal open={assignmentModal === 'technicians'} title="Select technicians" description="Choose one or more technicians from the selected group." onClose={() => setAssignmentModal(null)}>
        <div className="space-y-4">
          <div className="panel-subtle rounded-2xl p-4 text-sm text-muted">
            Group: <span className="text-app">{selectedGroup?.name || 'Not selected'}</span>
          </div>
          <Field label="Technicians">
            {!assignmentGroupId ? (
              <div className="panel-subtle rounded-2xl p-4 text-sm text-muted">Select an assignment group first.</div>
            ) : groupMembersLoading ? (
              <div className="panel-subtle rounded-2xl p-4 text-sm text-muted">Loading group members...</div>
            ) : groupMembersError ? (
              <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{groupMembersError}</div>
            ) : groupMembers.length === 0 ? (
              <div className="panel-subtle rounded-2xl p-4 text-sm text-muted">No active technicians are available in this group.</div>
            ) : (
              <div className="grid gap-2 rounded-2xl border border-app p-3">
                {groupMembers.map((member) => (
                  <label key={member.id} className="panel-subtle flex items-center justify-between rounded-2xl px-4 py-3">
                    <span className="text-sm text-app">{member.memberName || 'Technician'}</span>
                    <input
                      type="checkbox"
                      checked={selectedTechnicianIds.includes(member.technicianId)}
                      onChange={(event) =>
                        setSelectedTechnicianIds((current) =>
                          event.target.checked ? [...current, member.technicianId] : current.filter((selectedId) => selectedId !== member.technicianId),
                        )}
                    />
                  </label>
                ))}
              </div>
            )}
          </Field>
          <Field label="Lead technician">
            <select value={leadTechnicianId} onChange={(event) => setLeadTechnicianId(event.target.value)} className="field-input">
              <option value="">Select lead technician</option>
              {groupMembers.filter((member) => selectedTechnicianIds.includes(member.technicianId)).map((member) => (
                <option key={member.id} value={member.technicianId}>{member.memberName || 'Technician'}</option>
              ))}
            </select>
          </Field>
          <Field label="Notes">
            <textarea value={assignmentNotes} onChange={(event) => setAssignmentNotes(event.target.value)} className="field-input min-h-[100px]" />
          </Field>
          <div className="flex justify-end gap-3">
            <button type="button" className="button-secondary" onClick={() => setAssignmentModal(null)}>Cancel</button>
            <button type="button" className="button-primary" disabled={!assignmentGroupId || selectedTechnicianIds.length === 0} onClick={() => void submitTechnicianAssignment('technicians')}>Assign Work Order</button>
          </div>
        </div>
      </Modal>

      <Modal open={assignmentModal === 'reassign'} title="Reassign work order" description="Update the group, technicians, or lead assignment for this work order." onClose={() => setAssignmentModal(null)}>
        <div className="space-y-4">
          <Field label="Assignment group">
            <select value={assignmentGroupId} onChange={(event) => setAssignmentGroupId(event.target.value)} className="field-input">
              <option value="">Select assignment group</option>
              {data.assignmentGroups.map((group) => (
                <option key={group.id} value={group.id}>{group.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Technicians">
            {!assignmentGroupId ? (
              <div className="panel-subtle rounded-2xl p-4 text-sm text-muted">Select an assignment group first.</div>
            ) : groupMembersLoading ? (
              <div className="panel-subtle rounded-2xl p-4 text-sm text-muted">Loading group members...</div>
            ) : groupMembersError ? (
              <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{groupMembersError}</div>
            ) : groupMembers.length === 0 ? (
              <div className="panel-subtle rounded-2xl p-4 text-sm text-muted">No active technicians are available in this group.</div>
            ) : (
              <div className="grid gap-2 rounded-2xl border border-app p-3">
                {groupMembers.map((member) => (
                  <label key={member.id} className="panel-subtle flex items-center justify-between rounded-2xl px-4 py-3">
                    <span className="text-sm text-app">{member.memberName || 'Technician'}</span>
                    <input
                      type="checkbox"
                      checked={selectedTechnicianIds.includes(member.technicianId)}
                      onChange={(event) =>
                        setSelectedTechnicianIds((current) =>
                          event.target.checked ? [...current, member.technicianId] : current.filter((selectedId) => selectedId !== member.technicianId),
                        )}
                    />
                  </label>
                ))}
              </div>
            )}
          </Field>
          <Field label="Lead technician">
            <select value={leadTechnicianId} onChange={(event) => setLeadTechnicianId(event.target.value)} className="field-input">
              <option value="">Select lead technician</option>
              {groupMembers.filter((member) => selectedTechnicianIds.includes(member.technicianId)).map((member) => (
                <option key={member.id} value={member.technicianId}>{member.memberName || 'Technician'}</option>
              ))}
            </select>
          </Field>
          <Field label="Reason / notes">
            <textarea value={assignmentNotes} onChange={(event) => setAssignmentNotes(event.target.value)} className="field-input min-h-[100px]" />
          </Field>
          <div className="flex justify-end gap-3">
            <button type="button" className="button-secondary" onClick={() => setAssignmentModal(null)}>Cancel</button>
            <button type="button" className="button-primary" disabled={!assignmentGroupId || selectedTechnicianIds.length === 0} onClick={() => void submitTechnicianAssignment('reassign')}>Save Reassignment</button>
          </div>
        </div>
      </Modal>

      <Modal open={assignmentModal === 'response'} title="Technician response" description="Record whether the selected technician accepted or declined the job." onClose={() => setAssignmentModal(null)}>
        <div className="space-y-4">
          <Field label="Technician">
            <select value={responseTechnicianId} onChange={(event) => setResponseTechnicianId(event.target.value)} className="field-input">
              <option value="">Select technician</option>
              {workOrder.technicianAssignments?.map((assignment) => (
                <option key={assignment.technicianId} value={assignment.technicianId}>{assignment.technicianName}</option>
              ))}
            </select>
          </Field>
          <Field label="Response">
            <select value={responseValue} onChange={(event) => setResponseValue(event.target.value as 'Accepted' | 'Declined')} className="field-input">
              <option value="Accepted">Accepted</option>
              <option value="Declined">Declined</option>
            </select>
          </Field>
          <Field label="Notes">
            <textarea value={assignmentNotes} onChange={(event) => setAssignmentNotes(event.target.value)} className="field-input min-h-[100px]" />
          </Field>
          <div className="flex justify-end gap-3">
            <button type="button" className="button-secondary" onClick={() => setAssignmentModal(null)}>Cancel</button>
            <button type="button" className="button-primary" onClick={() => void submitTechnicianResponse()}>Save Response</button>
          </div>
        </div>
      </Modal>

      <Modal open={assignmentModal === 'arrival' || assignmentModal === 'departure'} title={assignmentModal === 'arrival' ? 'Record arrival' : 'Record departure'} description="Choose the technician to update and capture the current location." onClose={() => setAssignmentModal(null)}>
        <div className="space-y-4">
          <Field label="Technician">
            <select value={presenceTechnicianId} onChange={(event) => setPresenceTechnicianId(event.target.value)} className="field-input">
              <option value="">Select technician</option>
              {workOrder.technicianAssignments?.map((assignment) => (
                <option key={assignment.technicianId} value={assignment.technicianId}>{assignment.technicianName}</option>
              ))}
            </select>
          </Field>
          <div className="flex justify-end gap-3">
            <button type="button" className="button-secondary" onClick={() => setAssignmentModal(null)}>Cancel</button>
            <button type="button" className="button-primary" onClick={() => void recordLocation(assignmentModal === 'arrival' ? 'arrival' : 'departure')}>
              {assignmentModal === 'arrival' ? 'Save Arrival' : 'Save Departure'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={materialsOpen} title="Request materials" description="Create a material request for this work order." onClose={() => setMaterialsOpen(false)}>
        <div className="space-y-4">
          <Field label="Material item">
            <select value={materialLine.materialItemId} onChange={(event) => setMaterialLine((current) => ({ ...current, materialItemId: event.target.value }))} className="field-input">
              <option value="">Select item</option>
              {data.materials.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.itemName} ({item.quantityOnHand} {item.unitOfMeasure})
                </option>
              ))}
            </select>
          </Field>
          {selectedMaterial?.isLowStock ? (
            <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
              Low stock warning: only {selectedMaterial.quantityOnHand} {selectedMaterial.unitOfMeasure} are on hand for this item.
            </div>
          ) : null}
          <Field label="Quantity">
            <input
              type="number"
              min={1}
              value={materialLine.quantityRequested}
              onChange={(event) => setMaterialLine((current) => ({ ...current, quantityRequested: Number(event.target.value) || 1 }))}
              className="field-input"
            />
          </Field>
          <div className="flex justify-end gap-3">
            <button type="button" className="button-secondary" onClick={() => setMaterialsOpen(false)}>Cancel</button>
            <button type="button" className="button-primary" onClick={() => void requestMaterials()}>Create Request</button>
          </div>
        </div>
      </Modal>

      <Modal open={attachTemplateOpen} title="Attach PM template" description="Select the PM template that should be attached to this work order." onClose={() => setAttachTemplateOpen(false)}>
        <div className="space-y-4">
          <Field label="PM template">
            <select value={selectedPmTemplateId} onChange={(event) => setSelectedPmTemplateId(event.target.value)} className="field-input">
              <option value="">{data.pmTemplates.length === 0 ? 'No PM templates found' : 'Select PM template'}</option>
              {data.pmTemplates.map((template) => (
                <option key={template.id} value={template.id}>{template.name}</option>
              ))}
            </select>
          </Field>
          {data.pmTemplates.length === 0 ? (
            <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
              No PM templates found. Create a PM template before attaching a checklist.
            </div>
          ) : null}
          <div className="flex justify-end gap-3">
            <button type="button" className="button-secondary" onClick={() => setAttachTemplateOpen(false)} disabled={attachingTemplate}>Cancel</button>
            <button type="button" className="button-primary" onClick={() => void attachTemplate()} disabled={attachingTemplate || !selectedPmTemplateId}>
              {attachingTemplate ? 'Attaching...' : 'Attach Template'}
            </button>
          </div>
        </div>
      </Modal>
    </>
  )
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="surface-card">
      <div className="space-y-4">
        <p className="text-base font-semibold text-app">{title}</p>
        {children}
      </div>
    </section>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium text-app">{label}</span>
      {children}
    </label>
  )
}

function InlineMeta({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="panel-subtle flex items-center gap-2 rounded-full px-3 py-2 text-sm">
      <span className="text-muted">{label}:</span>
      <span className="font-medium text-app">{value}</span>
    </div>
  )
}

function KeyValue({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="panel-subtle rounded-2xl p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">{label}</p>
      <div className="mt-2 text-sm font-medium text-app">{value}</div>
    </div>
  )
}

function EmptyPanel({ message }: { message: string }) {
  return <div className="panel-subtle rounded-2xl p-4 text-sm text-muted">{message}</div>
}

function renderChecklistInput(item: WorkOrderChecklistItemRecord, draft: ChecklistDraft, onChange: (value: string) => void) {
  if (item.inputType === 'yesno' || item.inputType === 'boolean') {
    return (
      <select value={draft.responseValue} onChange={(event) => onChange(event.target.value)} className="field-input">
        <option value="">Select response</option>
        <option value="Yes">Yes</option>
        <option value="No">No</option>
      </select>
    )
  }

  if (item.inputType === 'passfail') {
    return (
      <select value={draft.responseValue} onChange={(event) => onChange(event.target.value)} className="field-input">
        <option value="">Select response</option>
        <option value="Pass">Pass</option>
        <option value="Fail">Fail</option>
      </select>
    )
  }

  if (item.inputType === 'dropdown') {
    return (
      <select value={draft.responseValue} onChange={(event) => onChange(event.target.value)} className="field-input">
        <option value="">Select response</option>
        {item.options.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
    )
  }

  if (item.inputType === 'date') {
    return <input type="date" value={draft.responseValue} onChange={(event) => onChange(event.target.value)} className="field-input" />
  }

  if (item.inputType === 'number') {
    return <input type="number" value={draft.responseValue} onChange={(event) => onChange(event.target.value)} className="field-input" />
  }

  return <textarea value={draft.responseValue} onChange={(event) => onChange(event.target.value)} className="field-input min-h-[96px]" />
}

function TimelineCard({ entry, compact = false }: { entry: TimelineEntry; compact?: boolean }) {
  return (
    <div className="panel-subtle rounded-2xl p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className={`font-semibold text-app ${compact ? 'text-sm' : ''}`}>{entry.title}</p>
          <p className="mt-1 text-xs text-muted">{formatDateTime(entry.when)}</p>
        </div>
        {entry.badge ? <Badge tone={entry.badge.tone}>{entry.badge.label}</Badge> : null}
      </div>
      <p className="mt-3 text-sm text-muted">{entry.body}</p>
      {entry.meta ? <p className="mt-2 text-xs text-muted">{entry.meta}</p> : null}
    </div>
  )
}

function resolveAssignedGroupName(workOrder: WorkOrder) {
  return workOrder.assignmentGroupName || 'No group'
}

function resolveAssignedToName(workOrder: WorkOrder) {
  return workOrder.leadTechnicianName
    || workOrder.assignedTechnicianName
    || workOrder.technicianAssignments?.find((assignment) => assignment.isLead)?.technicianName
    || workOrder.technicianAssignments?.find((assignment) => assignment.technicianName)?.technicianName
    || 'Unassigned'
}

function buildTimelineEntries(
  assignmentHistory: WorkOrderAssignmentHistoryRecord[],
  events: WorkOrderEventRecord[],
): TimelineEntry[] {
  const historyEntries = assignmentHistory.map((entry) => ({
    id: `assignment-${entry.id}`,
    title: entry.action,
    when: entry.performedAt,
    body: entry.notes || [entry.fromGroupName, entry.toGroupName, entry.fromTechnicianName, entry.toTechnicianName].filter(Boolean).join(' -> ') || 'Assignment updated',
    badge: { label: 'Assignment', tone: 'info' as const },
    meta: entry.performedByUserName || null,
  }))

  const eventEntries = events.map((event) => ({
    id: `event-${event.id}`,
    title: event.eventType,
    when: event.occurredAt,
    body: event.message,
    badge: event.status ? { label: event.status, tone: statusTone(event.status as never) } : undefined,
    meta: event.latitude != null && event.longitude != null ? `Location: ${event.latitude}, ${event.longitude}` : null,
  }))

  return [...historyEntries, ...eventEntries].sort((left, right) => new Date(right.when).getTime() - new Date(left.when).getTime())
}

function stringEquals(value: string | null | undefined, expected: string) {
  return value?.trim().toLowerCase() === expected.trim().toLowerCase()
}

function groupChecklistItems(items: WorkOrderChecklistItemRecord[]) {
  const groups = new Map<string, WorkOrderChecklistItemRecord[]>()
  for (const item of items) {
    const key = item.sectionName?.trim() || 'General'
    const group = groups.get(key) ?? []
    group.push(item)
    groups.set(key, group)
  }

  return [...groups.entries()]
    .map(([name, groupedItems]) => ({
      name,
      items: [...groupedItems].sort((left, right) => left.sortOrder - right.sortOrder),
    }))
    .sort((left, right) => left.name.localeCompare(right.name))
}
