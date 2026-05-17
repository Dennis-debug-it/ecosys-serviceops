import { Bot } from 'lucide-react'

export function KipButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      className="fixed bottom-5 right-5 z-40 inline-flex min-h-[52px] items-center gap-2 rounded-full border border-app bg-[var(--app-card)] px-5 py-3 text-sm font-semibold text-app shadow-[var(--app-shadow-soft)] transition hover:-translate-y-0.5"
      onClick={onClick}
    >
      <Bot className="h-4 w-4" />
      Ask KIP
    </button>
  )
}
