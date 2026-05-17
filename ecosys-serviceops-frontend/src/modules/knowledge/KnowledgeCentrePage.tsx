import { Plus, Search } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { EmptyState } from '../../components/ui/EmptyState'
import { ErrorState } from '../../components/ui/ErrorState'
import { LoadingState } from '../../components/ui/LoadingState'
import { useToast } from '../../components/ui/ToastProvider'
import { PageScaffold, SearchToolbar, SectionCard } from '../../components/ui/Workspace'
import { useAsyncData } from '../../hooks/useAsyncData'
import { knowledgeService } from '../../services/knowledgeService'
import type { KnowledgeArticleListItem, KnowledgeCategoryRecord } from '../../types/api'
import { formatDateTime } from '../../utils/date'

type KnowledgePageData = {
  articles: KnowledgeArticleListItem[]
  categories: KnowledgeCategoryRecord[]
}

const emptyData: KnowledgePageData = {
  articles: [],
  categories: [],
}

export function KnowledgeCentrePage() {
  const { pushToast } = useToast()
  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState('all')
  const [status, setStatus] = useState('all')
  const [showCategoryForm, setShowCategoryForm] = useState(false)
  const [categoryName, setCategoryName] = useState('')
  const [categoryDescription, setCategoryDescription] = useState('')

  const { data, loading, error, reload } = useAsyncData<KnowledgePageData>(
    async (signal) => {
      const articleResults = search.trim()
        ? await knowledgeService.search(search, categoryId === 'all' ? null : categoryId, signal)
        : await knowledgeService.listArticles({
            q: search,
            categoryId: categoryId === 'all' ? null : categoryId,
            status: status === 'all' ? null : status,
            signal,
          })

      const [articles, categories] = await Promise.all([
        Promise.resolve(articleResults),
        knowledgeService.listCategories(signal),
      ])
      return { articles, categories }
    },
    emptyData,
    [search, categoryId, status],
  )

  async function createCategory() {
    if (!categoryName.trim()) {
      pushToast({ title: 'Category name required', description: 'Enter a category name before saving.', tone: 'warning' })
      return
    }

    try {
      await knowledgeService.createCategory({
        name: categoryName.trim(),
        description: categoryDescription.trim() || null,
        displayOrder: data.categories.length + 1,
      })
      pushToast({ title: 'Category created', description: 'The Knowledge Centre category is ready to use.', tone: 'success' })
      setCategoryName('')
      setCategoryDescription('')
      setShowCategoryForm(false)
      await reload()
    } catch (nextError) {
      pushToast({ title: 'Save failed', description: nextError instanceof Error ? nextError.message : 'Unable to save category.', tone: 'danger' })
    }
  }

  if (loading) {
    return <LoadingState label="Loading Knowledge Centre" />
  }

  if (error) {
    return <ErrorState title="Unable to load Knowledge Centre" description={error} />
  }

  return (
    <PageScaffold
      eyebrow="Knowledge Centre"
      title="Operational knowledge that teams can actually reuse"
      description="Store SOPs, troubleshooting guides, and lessons learned, then surface them again where the work is happening."
      actions={(
        <div className="flex flex-wrap gap-2">
          <button type="button" className="button-secondary" onClick={() => setShowCategoryForm((current) => !current)}>
            {showCategoryForm ? 'Hide category form' : 'New category'}
          </button>
          <Link to="/knowledge/new" className="button-primary">
            <Plus className="h-4 w-4" />
            New article
          </Link>
        </div>
      )}
    >
      <SearchToolbar
        searchSlot={(
          <label className="block space-y-2">
            <span className="text-sm font-medium text-app">Search knowledge</span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="field-input pl-10"
                placeholder="Search titles, tags, categories, or troubleshooting notes"
              />
            </div>
          </label>
        )}
        filters={(
          <>
            <label className="block space-y-2">
              <span className="text-sm font-medium text-app">Category</span>
              <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)} className="field-input">
                <option value="all">All categories</option>
                {data.categories.map((category) => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              </select>
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-medium text-app">Status</span>
              <select value={status} onChange={(event) => setStatus(event.target.value)} className="field-input">
                <option value="all">All statuses</option>
                <option value="Draft">Draft</option>
                <option value="Published">Published</option>
                <option value="Archived">Archived</option>
              </select>
            </label>
          </>
        )}
      />

      {showCategoryForm ? (
        <SectionCard title="Create category" description="Keep the knowledge library organized so related guides are easier to discover.">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block space-y-2">
              <span className="text-sm font-medium text-app">Category name</span>
              <input value={categoryName} onChange={(event) => setCategoryName(event.target.value)} className="field-input" />
            </label>
            <label className="block space-y-2 md:col-span-2">
              <span className="text-sm font-medium text-app">Description</span>
              <textarea value={categoryDescription} onChange={(event) => setCategoryDescription(event.target.value)} className="field-input min-h-[110px]" />
            </label>
          </div>
          <div className="mt-4 flex justify-end">
            <button type="button" className="button-primary" onClick={() => void createCategory()}>Save category</button>
          </div>
        </SectionCard>
      ) : null}

      <SectionCard title="Articles" description="Published guides, active drafts, and archived institutional memory in one place.">
        {data.articles.length === 0 ? (
          <EmptyState title="No knowledge articles yet" description="Create the first article or broaden the search filters." />
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {data.articles.map((article) => (
              <Link key={article.id} to={`/knowledge/${article.id}`} className="rounded-[24px] border border-app bg-[var(--app-card)] p-5 shadow-[var(--app-shadow-soft)] transition hover:-translate-y-0.5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">{article.categoryName || 'General guide'}</p>
                  <span className="rounded-full bg-[var(--app-surface-strong)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-app">{article.status}</span>
                </div>
                <h2 className="mt-3 text-xl font-semibold text-app">{article.title}</h2>
                <p className="mt-2 text-sm leading-6 text-muted">{article.summary || 'No summary provided yet.'}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {article.tags.map((tag) => (
                    <span key={tag} className="rounded-full bg-[var(--app-primary-soft)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-app">{tag}</span>
                  ))}
                </div>
                <p className="mt-4 text-xs text-muted">Updated {formatDateTime(article.updatedAt)}</p>
              </Link>
            ))}
          </div>
        )}
      </SectionCard>
    </PageScaffold>
  )
}
