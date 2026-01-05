import { useMemo, useState } from 'react'
import type { Artifact, Event } from './types'
import { explainEvent, labelForClass } from './reasonMap'

type ReviewLogProps = {
  artifact: Artifact | null
  currentTick: number
  onSelectToken: (tokenId: string | null) => void
  selectedTokenId: string | null
  inspectorEnabled: boolean
}

const classAccent: Record<string, string> = {
  PAID: 'var(--accent)',
  FREE: 'var(--accent-2)',
  ANON: 'var(--muted)',
}

const formatTime = (ms: number) => {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

const buildEventKey = (event: Event, index: number) =>
  `${event.tick}-${event.token_id}-${index}`

export const ReviewLog = ({
  artifact,
  currentTick,
  onSelectToken,
  selectedTokenId,
  inspectorEnabled,
}: ReviewLogProps) => {
  const [expandedKey, setExpandedKey] = useState<string | null>(null)

  const visibleEvents = useMemo(() => {
    if (!artifact) return [] as Array<{ event: Event; key: string }>

    return artifact.events
      .map((event, index) => ({ event, key: buildEventKey(event, index) }))
      .filter(({ event }) => event.tick <= currentTick)
  }, [artifact, currentTick])

  if (!artifact) {
    return (
      <div className="flex h-full items-center justify-center text-sm font-medium text-[var(--muted)]">
        Review log will appear here.
      </div>
    )
  }

  const handleSelect = (event: Event, key: string) => {
    onSelectToken(selectedTokenId === event.token_id ? null : event.token_id)
    setExpandedKey((prev) => (prev === key ? null : key))
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-xs font-medium text-[var(--muted)]">
        Review Log
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        {visibleEvents.length === 0 ? (
          <div className="m-4 rounded-2xl border border-dashed border-[var(--border)] bg-[var(--paper-soft)] px-4 py-6 text-center text-sm font-medium text-[var(--muted)]">
            No events yet.
          </div>
        ) : (
          <div className="flex flex-col-reverse">
            {visibleEvents.map(({ event, key }) => {
              const time = event.tick * artifact.metadata.tick_duration_ms
              const isSelected = selectedTokenId === event.token_id
              const isExpanded = expandedKey === key
              const accent = classAccent[event.class] ?? 'var(--ink)'
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleSelect(event, key)}
                  className={`w-full border-b border-[var(--border)] px-4 py-3 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/20 ${
                    isSelected
                      ? 'bg-[var(--accent-soft)]'
                      : 'bg-transparent hover:bg-[var(--paper-soft)]'
                  }`}
                >
                  <div className="flex items-center justify-between text-[11px] font-medium text-[var(--muted)]">
                    <span>{formatTime(time)}</span>
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: accent }}
                      />
                      <span className="rounded-full border border-[var(--border)] bg-[var(--paper-soft)] px-2 py-0.5 text-[10px] font-medium text-[var(--ink)]">
                        {labelForClass(event.class)}
                      </span>
                    </div>
                  </div>
                  <div className="mt-2 text-sm font-medium leading-relaxed text-[var(--ink)]">
                    {explainEvent(event)}
                  </div>
                  {inspectorEnabled ? (
                    <div className="mt-2 text-[11px] font-medium text-[var(--muted)]">
                      Reason: {event.reason_code}
                    </div>
                  ) : null}
                  {isExpanded ? (
                    <div className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--paper-soft)] px-3 py-2 text-[11px] text-[var(--muted)]">
                      <div>Token: {event.token_id}</div>
                      <div>Reason: {event.reason_code}</div>
                    </div>
                  ) : null}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
