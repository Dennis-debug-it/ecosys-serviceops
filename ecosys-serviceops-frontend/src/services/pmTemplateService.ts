import { api } from '../lib/api'
import type { PmTemplateRecord, UpsertPmTemplateInput } from '../types/api'
import { asArray } from '../utils/apiDefaults'

export const pmTemplateService = {
  async list(signal?: AbortSignal): Promise<PmTemplateRecord[]> {
    const response = await api.get<unknown>('/api/pm/templates', { signal })
    return asArray<PmTemplateRecord>(response)
  },
  get(id: string, signal?: AbortSignal) {
    return api.get<PmTemplateRecord>(`/api/pm/templates/${id}`, { signal })
  },
  create(input: UpsertPmTemplateInput) {
    return api.post<PmTemplateRecord>('/api/pm/templates', input)
  },
  update(id: string, input: UpsertPmTemplateInput) {
    return api.put<PmTemplateRecord>(`/api/pm/templates/${id}`, input)
  },
  remove(id: string) {
    return api.delete<void>(`/api/pm/templates/${id}`)
  },
}
