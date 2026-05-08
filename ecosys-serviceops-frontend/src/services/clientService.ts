import { api } from '../lib/api'
import type { ClientRecord, UpsertClientInput } from '../types/api'
import { asArray } from '../utils/apiDefaults'

export const clientService = {
  async list(options?: { search?: string; status?: 'active' | 'inactive' | 'all'; signal?: AbortSignal }): Promise<ClientRecord[]> {
    const response = await api.get<unknown>('/api/clients', {
      query: {
        search: options?.search?.trim() || undefined,
        status: options?.status || undefined,
      },
      signal: options?.signal,
    })
    return asArray<ClientRecord>(response)
  },
  get(id: string, signal?: AbortSignal) {
    return api.get<ClientRecord>(`/api/clients/${id}`, { signal })
  },
  create(input: UpsertClientInput) {
    return api.post<ClientRecord>('/api/clients', input)
  },
  update(id: string, input: UpsertClientInput) {
    return api.put<ClientRecord>(`/api/clients/${id}`, input)
  },
  activate(id: string) {
    return api.patch<ClientRecord>(`/api/clients/${id}/activate`)
  },
  deactivate(id: string) {
    return api.patch<ClientRecord>(`/api/clients/${id}/deactivate`)
  },
}
