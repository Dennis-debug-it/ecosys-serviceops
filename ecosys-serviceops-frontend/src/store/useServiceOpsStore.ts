'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { serviceOpsData } from '@/saas/mock/data'
import type { ModalState, ServiceOpsData, ThemeMode, TimeRange, WorkOrder } from '@/saas/types'

type NewWorkOrderPayload = {
  title: string
  client: string
  site: string
  asset: string
  priority: WorkOrder['priority']
  technicianName: string
  technicianInitials: string
}

type ServiceOpsStore = ServiceOpsData & {
  theme: ThemeMode
  timeRange: TimeRange
  searchQuery: string
  sidebarOpen: boolean
  mobileSidebarOpen: boolean
  modalState: ModalState
  setTheme: (theme: ThemeMode) => void
  toggleTheme: () => void
  setTimeRange: (timeRange: TimeRange) => void
  setSearchQuery: (searchQuery: string) => void
  setSidebarOpen: (sidebarOpen: boolean) => void
  setMobileSidebarOpen: (mobileSidebarOpen: boolean) => void
  openNewWorkOrderModal: () => void
  closeModal: () => void
  createWorkOrder: (payload: NewWorkOrderPayload) => void
}

function buildWorkOrderNumber(nextIndex: number) {
  return `WO-NBO-2026-${String(nextIndex).padStart(4, '0')}`
}

export const useServiceOpsStore = create<ServiceOpsStore>()(
  persist(
    (set) => ({
      ...serviceOpsData,
      theme: 'dark',
      timeRange: 'Today',
      searchQuery: '',
      sidebarOpen: true,
      mobileSidebarOpen: false,
      modalState: { type: 'none' },
      setTheme: (theme) => set({ theme }),
      toggleTheme: () => set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' })),
      setTimeRange: (timeRange) => set({ timeRange }),
      setSearchQuery: (searchQuery) => set({ searchQuery }),
      setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
      setMobileSidebarOpen: (mobileSidebarOpen) => set({ mobileSidebarOpen }),
      openNewWorkOrderModal: () =>
        set({
          modalState: {
            type: 'newWorkOrder',
            title: 'Create Work Order',
            description:
              'Capture a new service request without leaving the current workspace.',
          },
        }),
      closeModal: () => set({ modalState: { type: 'none' } }),
      createWorkOrder: (payload) =>
        set((state) => {
          const nextIndex = state.workOrders.length + 40
          const nextWorkOrder: WorkOrder = {
            id: `wo-${nextIndex}`,
            number: buildWorkOrderNumber(nextIndex),
            title: payload.title,
            client: payload.client,
            site: payload.site,
            asset: payload.asset,
            status: 'Open',
            technician: { name: payload.technicianName, initials: payload.technicianInitials },
            priority: payload.priority,
            slaState: 'On Track',
            slaLabel: 'New',
            branch: state.tenant.branch,
            createdAt: 'Just now',
            scheduledAt: 'To be assigned',
            description: payload.title,
            costImpact: 'Pending assessment',
            category: 'Reactive',
            notes: ['Work order created from quick-create modal.'],
            materialsRequested: [],
            timeline: [
              {
                id: `timeline-${nextIndex}-1`,
                label: 'Work Order Created',
                time: 'Just now - Control Desk',
                status: 'active',
              },
            ],
          }

          return {
            workOrders: [nextWorkOrder, ...state.workOrders],
            modalState: { type: 'none' },
            stats: state.stats.map((stat) =>
              stat.id === 'open'
                ? { ...stat, value: String(Number(stat.value) + 1) }
                : stat,
            ),
          }
        }),
    }),
    {
      name: 'ecosys-next-serviceops-store',
      partialize: (state) => ({
        theme: state.theme,
        timeRange: state.timeRange,
        workOrders: state.workOrders,
        stats: state.stats,
      }),
    },
  ),
)
