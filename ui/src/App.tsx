import { useState } from 'react'
import { FlowCanvas } from './FlowCanvas'
import { ReviewLog } from './ReviewLog'
import { useArtifactSlots, slotLabel } from './hooks/useArtifactSlots'
import { useCopyFeedback } from './hooks/useCopyFeedback'
import { useInspectorData } from './hooks/useInspectorData'
import { usePlayback } from './hooks/usePlayback'
import { useViewportWidth } from './hooks/useViewportWidth'
import type { Artifact } from './types'

const formatTime = (ms: number) => {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

const UI_ENGINE_VERSION = '0.1.0'

const buildReplayReference = (metadata: Artifact['metadata']) =>
  `finit://replay?scenario_id=${encodeURIComponent(
    metadata.scenario_id,
  )}&seed=${metadata.seed}&engine_version=${encodeURIComponent(
    metadata.engine_version,
  )}&replay_id=${encodeURIComponent(metadata.replay_id)}`

function App() {
  const [selectedTokenId, setSelectedTokenId] = useState<string | null>(null)
  const [inspectorEnabled, setInspectorEnabled] = useState(false)
  const handleSlotChange = () => {
    setSelectedTokenId(null)
    setInspectorEnabled(false)
  }
  const {
    activeLabel,
    activeSlot,
    artifact,
    baselineArtifact,
    loadError,
    handleFile,
    handleSwitchSlot,
    pressureArtifact,
  } = useArtifactSlots({ onSlotChange: handleSlotChange })
  const {
    animationDuration,
    currentTick,
    currentTime,
    handleScrub,
    handleTogglePlay,
    isPlaying,
    tickCount,
    totalTime,
  } = usePlayback(artifact, { playbackScale: 3, resetKey: activeSlot })
  const { copyStatus, copyVisible, handleCopy } = useCopyFeedback()
  const { stateCounts, reasonCounts } = useInspectorData(artifact, currentTick)
  const viewportWidth = useViewportWidth()
  const isMobile = viewportWidth < 640
  const isCompact = viewportWidth < 768
  const flowLayoutMode: 'horizontal' | 'vertical' = isCompact ? 'vertical' : 'horizontal'

  const versionMismatch = artifact && artifact.metadata.engine_version !== UI_ENGINE_VERSION

  return (
    <div className="flex min-h-screen flex-col bg-[var(--paper)] text-[var(--ink)] lg:h-screen">
      <header className="flex flex-col gap-2 border-b border-[var(--border-soft)] bg-transparent px-4 py-2 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-center gap-4">
          <div className="text-[12px] font-medium tracking-[0.04em] text-[var(--ink)]">Finit</div>
          <div className="text-[11px] text-[var(--muted)]">Design review playback</div>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-[var(--muted)]">
          <div className="flex items-center gap-2">
            <span className="text-[10px] tracking-[0.04em] text-[var(--muted)]">Scenario</span>
            <span className="text-[12px] text-[var(--ink)]">
              {artifact?.metadata.scenario_id ?? '—'} · {activeLabel}
            </span>
          </div>
          <div className="hidden h-3 w-px bg-[var(--border-soft)] sm:block" />
          <div className="flex items-center gap-2">
            <span className="text-[10px] tracking-[0.04em] text-[var(--muted)]">Replay</span>
            <span className="max-w-[160px] truncate font-mono text-[12px] text-[var(--ink)] sm:max-w-[200px]">
              {artifact?.metadata.replay_id ?? '—'}
            </span>
          </div>
          {versionMismatch ? (
            <div
              className="rounded-full border border-[var(--border-soft)] px-2 py-0.5 text-[10px] text-[var(--muted)]"
              title={`Artifact engine_version=${artifact?.metadata.engine_version}; UI expects ${UI_ENGINE_VERSION}`}
            >
              Version mismatch
            </div>
          ) : null}
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto px-4 py-3 sm:px-6 lg:overflow-hidden">
        <div className="flex min-h-0 flex-col gap-4 lg:grid lg:h-full lg:grid-cols-[200px_1fr_280px] lg:gap-6">
          <aside className="order-2 flex flex-col gap-4 overflow-visible rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] p-4 text-[var(--ink)] lg:order-1 lg:min-h-0 lg:overflow-y-auto lg:rounded-none lg:border-0 lg:border-r lg:bg-transparent lg:p-0 lg:pr-6">
            <div className="pb-3">
              <div className="text-[11px] font-medium text-[var(--muted)]">Run Slots</div>
              <div className="mt-3 flex flex-col gap-2">
                {(['baseline', 'pressure'] as const).map((slot) => {
                  const isActive = slot === activeSlot
                  const isLoaded = slot === 'baseline' ? baselineArtifact : pressureArtifact
                  return (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => handleSwitchSlot(slot)}
                      className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-[13px] font-medium transition-colors ${
                        isActive
                          ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]'
                          : 'border-transparent bg-transparent text-[var(--muted)] hover:border-[var(--border-soft)] hover:bg-[var(--paper-soft)] hover:text-[var(--ink)]'
                      }`}
                    >
                      <span>{slotLabel(slot)}</span>
                      <span
                        className={`h-2.5 w-2.5 rounded-full ${
                          isLoaded ? 'bg-[var(--accent)]' : 'bg-[var(--border)]'
                        }`}
                      />
                    </button>
                  )
                })}
              </div>
              <div className="mt-3 grid gap-2">
                <label className="flex cursor-pointer items-center justify-between rounded-md border border-dashed border-[var(--border-soft)] bg-transparent px-3 py-2 text-[12px] font-medium text-[var(--muted)] transition-colors hover:border-[var(--accent-2)] hover:bg-[var(--paper-soft)] hover:text-[var(--ink)]">
                  <span>Load Baseline</span>
                  <input
                    type="file"
                    accept="application/json"
                    onChange={handleFile('baseline')}
                    className="hidden"
                  />
                </label>
                <label className="flex cursor-pointer items-center justify-between rounded-md border border-dashed border-[var(--border-soft)] bg-transparent px-3 py-2 text-[12px] font-medium text-[var(--muted)] transition-colors hover:border-[var(--accent-2)] hover:bg-[var(--paper-soft)] hover:text-[var(--ink)]">
                  <span>Load High Pressure</span>
                  <input
                    type="file"
                    accept="application/json"
                    onChange={handleFile('pressure')}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            <div className="border-t border-[var(--border-soft)] pt-4">
              <div className="text-[11px] font-medium text-[var(--muted)]">Inspector</div>
              <button
                type="button"
                onClick={() => setInspectorEnabled((prev) => !prev)}
                className={`mt-3 flex w-full items-center justify-between rounded-md border px-3 py-2 text-[12px] font-medium transition-colors ${
                  inspectorEnabled
                    ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]'
                    : 'border-[var(--border-soft)] bg-transparent text-[var(--muted)] hover:bg-[var(--paper-soft)] hover:text-[var(--ink)]'
                }`}
              >
                <span>{inspectorEnabled ? 'On' : 'Off'}</span>
                <span className="text-[11px] text-[var(--muted)]">Toggle</span>
              </button>
              {inspectorEnabled && isMobile && stateCounts ? (
                <div className="mt-3 rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] px-3 py-3 text-xs text-[var(--ink)]">
                  <div className="text-[10px] font-medium text-[var(--muted)]">Inspector</div>
                  <div className="mt-2 space-y-1 text-[11px]">
                    <div>Queued: {stateCounts.queued}</div>
                    <div>Processing: {stateCounts.processing}</div>
                    <div>Done: {stateCounts.done}</div>
                    <div>Rejected: {stateCounts.rejected}</div>
                    <div className="mt-2 border-t border-[var(--border-soft)] pt-2 text-[10px] font-medium text-[var(--muted)]">
                      Reasons @ tick {currentTick}
                    </div>
                    {reasonCounts && reasonCounts.size === 0 ? (
                      <div className="mt-1 text-[11px] text-[var(--muted)]">No events</div>
                    ) : (
                      <div className="mt-1 space-y-1 text-[11px]">
                        {Array.from(reasonCounts ?? []).map(([reason, count]) => (
                          <div key={reason}>
                            {reason} × {count}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="relative border-t border-[var(--border-soft)] pt-4">
              <div className="text-[11px] font-medium text-[var(--muted)]">Replay Tools</div>
              <div className="mt-3 rounded-lg border border-[var(--border-soft)] bg-[var(--paper-soft)] px-3 py-2 text-[11px] text-[var(--ink)]">
                <div className="text-[10px] font-medium text-[var(--muted)]">Replay ID</div>
                <div className="mt-1 truncate font-mono text-[12px] font-medium">
                  {artifact?.metadata.replay_id ?? '—'}
                </div>
              </div>
              <div className="relative mt-3 grid gap-2">
                <button
                  type="button"
                  onClick={() => artifact && handleCopy(artifact.metadata.replay_id, 'Replay ID')}
                  className="rounded-md border border-[var(--border-soft)] bg-transparent px-3 py-2 text-[12px] font-medium text-[var(--muted)] transition-colors hover:border-[var(--accent-2)] hover:bg-[var(--paper-soft)] hover:text-[var(--ink)] disabled:cursor-not-allowed disabled:border-[var(--border-soft)] disabled:text-[var(--muted)]"
                  disabled={!artifact}
                >
                  Copy Replay ID
                </button>
                <button
                  type="button"
                  onClick={() =>
                    artifact &&
                    handleCopy(buildReplayReference(artifact.metadata), 'Replay reference')
                  }
                  className="rounded-md border border-[var(--border-soft)] bg-transparent px-3 py-2 text-[12px] font-medium text-[var(--muted)] transition-colors hover:border-[var(--accent-2)] hover:bg-[var(--paper-soft)] hover:text-[var(--ink)] disabled:cursor-not-allowed disabled:border-[var(--border-soft)] disabled:text-[var(--muted)]"
                  disabled={!artifact}
                >
                  Copy Reference
                </button>
                {copyStatus ? (
                  <span
                    role="status"
                    aria-live="polite"
                    className={`pointer-events-none absolute left-1/2 top-full mt-3 -translate-x-1/2 whitespace-nowrap rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-[11px] font-medium text-[var(--muted)] shadow-[0_2px_6px_rgba(16,24,40,0.08)] transition-all duration-200 ease-out ${
                      copyVisible ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
                    }`}
                  >
                    {copyStatus}
                  </span>
                ) : null}
              </div>
            </div>
          </aside>

          <section className="order-1 flex h-[40vh] min-h-[40vh] flex-col sm:h-[60vh] sm:min-h-[60vh] md:h-[62vh] md:min-h-[62vh] lg:order-2 lg:h-auto lg:min-h-0">
            <div className="flex-1">
              {artifact ? (
                <FlowCanvas
                  artifact={artifact}
                  currentTick={currentTick}
                  animationDuration={animationDuration}
                  highlightedTokenId={selectedTokenId}
                  inspectorEnabled={inspectorEnabled}
                  flowLayout={flowLayoutMode}
                  inspectorStateCounts={stateCounts}
                  inspectorReasonCounts={reasonCounts}
                  showInspectorOverlay={!isMobile}
                />
              ) : (
                <div className="canvas-grid relative h-full min-h-[40vh] rounded-xl border border-[var(--border-soft)] bg-[var(--paper-soft)] sm:min-h-[60vh] md:min-h-[62vh] lg:min-h-0">
                  <div className="max-w-sm px-6 pt-6 text-[13px] font-medium leading-relaxed text-[var(--muted)]">
                    {loadError ??
                      `Load the ${activeLabel.toLowerCase()} run artifact to start playback.`}
                  </div>
                </div>
              )}
            </div>
          </section>

          <aside className="order-3 flex h-[22vh] flex-col overflow-hidden rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] sm:h-[40vh] md:h-[45vh] lg:order-3 lg:h-full lg:min-h-0 lg:rounded-none lg:border-0 lg:border-l lg:bg-transparent">
            <ReviewLog
              artifact={artifact}
              currentTick={currentTick}
              onSelectToken={setSelectedTokenId}
              selectedTokenId={selectedTokenId}
              inspectorEnabled={inspectorEnabled}
            />
          </aside>
        </div>
      </main>

      <footer className="border-t border-[var(--border-soft)] bg-transparent px-4 py-2 sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
          <button
            type="button"
            onClick={handleTogglePlay}
            className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-center text-sm text-[var(--ink)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:border-[var(--border-soft)] disabled:text-[var(--muted)] sm:w-[96px]"
            disabled={!artifact}
          >
            {isPlaying ? 'Pause' : 'Play'}
          </button>
          <div className="flex flex-1 flex-col">
            <input
              type="range"
              min={0}
              max={Math.max(tickCount - 1, 0)}
              value={currentTick}
              onChange={handleScrub}
              className="w-full"
              style={{ accentColor: 'var(--accent)' }}
              disabled={!artifact}
            />
            <div className="mt-2 flex items-center justify-between text-[11px] text-[var(--muted)]">
              <span>
                {formatTime(currentTime)} / {formatTime(totalTime)}
              </span>
              <span>Tick {artifact ? currentTick : 0}</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default App
