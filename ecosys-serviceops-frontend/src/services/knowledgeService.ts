import { api } from '../lib/api'
import type {
  KnowledgeArticleDetail,
  KnowledgeArticleListItem,
  KnowledgeCategoryRecord,
  UpsertKnowledgeArticleInput,
  UpsertKnowledgeCategoryInput,
} from '../types/api'
import { asArray } from '../utils/apiDefaults'

export const knowledgeService = {
  async listArticles(options?: { q?: string; categoryId?: string | null; status?: string | null; signal?: AbortSignal }): Promise<KnowledgeArticleListItem[]> {
    const response = await api.get<unknown>('/api/knowledge/articles', {
      query: {
        q: options?.q?.trim() || undefined,
        categoryId: options?.categoryId || undefined,
        status: options?.status || undefined,
      },
      signal: options?.signal,
    })
    return asArray<KnowledgeArticleListItem>(response)
  },

  createArticle(input: UpsertKnowledgeArticleInput) {
    return api.post<KnowledgeArticleDetail>('/api/knowledge/articles', input)
  },

  getArticle(id: string, signal?: AbortSignal) {
    return api.get<KnowledgeArticleDetail>(`/api/knowledge/articles/${id}`, { signal })
  },

  updateArticle(id: string, input: UpsertKnowledgeArticleInput) {
    return api.put<KnowledgeArticleDetail>(`/api/knowledge/articles/${id}`, input)
  },

  deleteArticle(id: string) {
    return api.delete<void>(`/api/knowledge/articles/${id}`)
  },

  publishArticle(id: string) {
    return api.post<KnowledgeArticleDetail>(`/api/knowledge/articles/${id}/publish`)
  },

  archiveArticle(id: string) {
    return api.post<KnowledgeArticleDetail>(`/api/knowledge/articles/${id}/archive`)
  },

  async listCategories(signal?: AbortSignal): Promise<KnowledgeCategoryRecord[]> {
    const response = await api.get<unknown>('/api/knowledge/categories', { signal })
    return asArray<KnowledgeCategoryRecord>(response)
  },

  createCategory(input: UpsertKnowledgeCategoryInput) {
    return api.post<KnowledgeCategoryRecord>('/api/knowledge/categories', input)
  },

  async search(query: string, categoryId?: string | null, signal?: AbortSignal): Promise<KnowledgeArticleListItem[]> {
    const response = await api.get<unknown>('/api/knowledge/search', {
      query: {
        q: query.trim() || undefined,
        categoryId: categoryId || undefined,
      },
      signal,
    })
    return asArray<KnowledgeArticleListItem>(response)
  },

  async getSuggestionsForWorkOrder(workOrderId: string, signal?: AbortSignal): Promise<KnowledgeArticleListItem[]> {
    const response = await api.get<unknown>(`/api/knowledge/suggestions/work-order/${workOrderId}`, { signal })
    return asArray<KnowledgeArticleListItem>(response)
  },

  async getRelatedArticles(id: string, signal?: AbortSignal): Promise<KnowledgeArticleListItem[]> {
    const response = await api.get<unknown>(`/api/knowledge/articles/${id}/related`, { signal })
    return asArray<KnowledgeArticleListItem>(response)
  },

  draftFromWorkOrder(workOrderId: string) {
    return api.post<KnowledgeArticleDetail>(`/api/knowledge/articles/from-work-order/${workOrderId}`)
  },
}
