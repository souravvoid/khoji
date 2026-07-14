import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { EmptyState } from '../ui/EmptyState'
import { useDocumentStore } from '../../stores/documentStore'
import { generateTimeline, type TimelineEvent } from '../../lib/ipc'

export function TimelineTab() {
  const { activeDocument } = useDocumentStore()
  const [events, setEvents] = useState<TimelineEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [fetchError, setFetchError] = useState('')

  useEffect(() => {
    if (!activeDocument) return
    setLoading(true)
    setFetchError('')
    generateTimeline(activeDocument.id)
      .then((list: TimelineEvent[]) => {
        setEvents(list)
      })
      .catch(() => {
        setEvents([])
        setFetchError('Failed to generate timeline')
      })
      .finally(() => setLoading(false))
  }, [activeDocument?.id])

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-text-tertiary" />
      </div>
    )
  }

  if (fetchError) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-sm text-status-error">{fetchError}</p>
      </div>
    )
  }

  if (events.length === 0) {
    return (
      <EmptyState
        icon={<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>}
        title="No timeline events"
        description="A timeline will be generated when you process a document with chronological content."
      />
    )
  }

  return (
    <div className="h-full overflow-y-auto scrollbar-thin p-6">
      <h3 className="text-sm font-semibold text-text-primary mb-6">Timeline of Events</h3>
      <div className="relative">
        <div className="absolute left-[19px] top-0 bottom-0 w-0.5 bg-primary-200" />
        <div className="space-y-6">
          {events.map((event: TimelineEvent, i: number) => (
            <div key={i} className="relative flex gap-4 group">
              <div className="flex-shrink-0 w-10 flex items-start justify-center">
                <div className="w-4 h-4 rounded-full bg-primary-500 border-2 border-white shadow-sm mt-1 z-10 transition-transform group-hover:scale-125" />
              </div>
              <div className="flex-1 pb-2">
                <span className="inline-block px-2 py-0.5 bg-primary-100 text-primary-700 text-xs font-medium rounded-none mb-2">
                  {event.date}
                </span>
                <h4 className="text-sm font-semibold text-text-primary">{event.title}</h4>
                <p className="text-sm text-text-secondary mt-1 leading-relaxed">{event.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
