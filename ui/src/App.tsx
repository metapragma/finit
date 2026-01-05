import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { FlowCanvas } from './FlowCanvas'
import { ReviewLog } from './ReviewLog'
import { parseArtifact } from './parseArtifact'
import type { Artifact } from './types'

const formatTime = (ms: number) => {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

const UI_ENGINE_VERSION = '0.1.0'
type RunSlot = 'baseline' | 'pressure'

const slotLabel = (slot: RunSlot) =>
  slot === 'baseline' ? 'Baseline' : 'High Pressure'

const buildReplayReference = (metadata: Artifact['metadata']) =>
  `finit://replay?scenario_id=${encodeURIComponent(
    metadata.scenario_id,
  )}&seed=${metadata.seed}&engine_version=${encodeURIComponent(
    metadata.engine_version,
  )}&replay_id=${encodeURIComponent(metadata.replay_id)}`

function App() {
  const [baselineArtifact, setBaselineArtifact] = useState<Artifact | null>(null)
  const [pressureArtifact, setPressureArtifact] = useState<Artifact | null>(null)
  const [baselineError, setBaselineError] = useState<string | null>(null)
  const [pressureError, setPressureError] = useState<string | null>(null)
  const [activeSlot, setActiveSlot] = useState<RunSlot>('baseline')
  const [currentTick, setCurrentTick] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [selectedTokenId, setSelectedTokenId] = useState<string | null>(null)
  const [copyStatus, setCopyStatus] = useState<string | null>(null)
  const [copyVisible, setCopyVisible] = useState(false)
  const [inspectorEnabled, setInspectorEnabled] = useState(false)
  const hideTimer = useRef<number | null>(null)
  const clearTimer = useRef<number | null>(null)

  const artifact =
    activeSlot === 'baseline' ? baselineArtifact : pressureArtifact
  const loadError =
    activeSlot === 'baseline' ? baselineError : pressureError
  const activeLabel = slotLabel(activeSlot)
  const scenarioGate =
    baselineArtifact?.metadata.scenario_id ??
    pressureArtifact?.metadata.scenario_id ??
    null

  const tickCount = artifact?.metadata.tick_count ?? 0
  const tickDuration = artifact?.metadata.tick_duration_ms ?? 250
  const playbackScale = 3
  const playbackInterval = tickDuration * playbackScale
  const animationDuration = Math.min((playbackInterval / 1000) * 0.8, 0.6)

  const currentTime = useMemo(() => {
    if (!artifact) return 0
    return currentTick * playbackInterval
  }, [artifact, currentTick, playbackInterval])

  const totalTime = useMemo(() => {
    if (!artifact) return 0
    return Math.max((tickCount - 1) * playbackInterval, 0)
  }, [artifact, playbackInterval, tickCount])

  const versionMismatch =
    artifact && artifact.metadata.engine_version !== UI_ENGINE_VERSION

  useEffect(() => {
    if (!artifact || !isPlaying) return

    const interval = window.setInterval(() => {
      setCurrentTick((prev) => {
        const next = prev + 1
        if (next >= artifact.metadata.tick_count) {
          setIsPlaying(false)
          return prev
        }
        return next
      })
    }, playbackInterval)

    return () => window.clearInterval(interval)
  }, [artifact, isPlaying, playbackInterval])

  const handleFile =
    (slot: RunSlot) => async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (!file) return

      const setError = slot === 'baseline' ? setBaselineError : setPressureError
      const setArtifact =
        slot === 'baseline' ? setBaselineArtifact : setPressureArtifact

      try {
        const text = await file.text()
        const json = JSON.parse(text)
        const result = parseArtifact(json)
        if (!result.ok) {
          setError(result.error)
          return
        }

        if (
          scenarioGate &&
          result.artifact.metadata.scenario_id !== scenarioGate
        ) {
          setError('Scenario mismatch. MVP supports one scenario only.')
          return
        }

        setArtifact(result.artifact)
        setError(null)
        setActiveSlot(slot)
        setCurrentTick(0)
        setIsPlaying(false)
        setSelectedTokenId(null)
        setInspectorEnabled(false)
      } catch (error) {
        setError('Unable to parse artifact JSON.')
      } finally {
        event.target.value = ''
      }
    }

  const handleSwitchSlot = (slot: RunSlot) => {
    setActiveSlot(slot)
    setCurrentTick(0)
    setIsPlaying(false)
    setSelectedTokenId(null)
  }

  const handleTogglePlay = () => {
    if (!artifact) return
    if (currentTick >= artifact.metadata.tick_count - 1) {
      setCurrentTick(0)
    }
    setIsPlaying((prev) => !prev)
  }

  const handleScrub = (event: ChangeEvent<HTMLInputElement>) => {
    const nextTick = Number(event.target.value)
    setCurrentTick(nextTick)
    setIsPlaying(false)
  }

  const handleCopy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value)
      setCopyStatus(`${label} copied`)
      setCopyVisible(false)
      requestAnimationFrame(() => setCopyVisible(true))
      if (hideTimer.current) window.clearTimeout(hideTimer.current)
      if (clearTimer.current) window.clearTimeout(clearTimer.current)
      hideTimer.current = window.setTimeout(() => {
        setCopyVisible(false)
      }, 2200)
      clearTimer.current = window.setTimeout(() => {
        setCopyStatus(null)
      }, 2800)
    } catch (error) {
      setCopyStatus('Copy failed')
      setCopyVisible(false)
      requestAnimationFrame(() => setCopyVisible(true))
      if (hideTimer.current) window.clearTimeout(hideTimer.current)
      if (clearTimer.current) window.clearTimeout(clearTimer.current)
      hideTimer.current = window.setTimeout(() => {
        setCopyVisible(false)
      }, 2200)
      clearTimer.current = window.setTimeout(() => {
        setCopyStatus(null)
      }, 2800)
    }
  }

  useEffect(() => {
    return () => {
      if (hideTimer.current) window.clearTimeout(hideTimer.current)
      if (clearTimer.current) window.clearTimeout(clearTimer.current)
    }
  }, [])

  return (
    <div className="flex h-screen flex-col bg-[var(--paper)] text-[var(--ink)]">
      <header className="flex items-center justify-between border-b border-[var(--border-soft)] bg-transparent px-6 py-2">
        <div className="flex items-center gap-4">
          <div className="text-[12px] font-medium tracking-[0.04em] text-[var(--ink)]">
            Finit
          </div>
          <div className="text-[11px] text-[var(--muted)]">
            Design review playback
          </div>
        </div>
        <div className="flex items-center gap-4 text-[11px] text-[var(--muted)]">
          <div className="flex items-center gap-2">
            <span className="text-[10px] tracking-[0.04em] text-[var(--muted)]">
              Scenario
            </span>
            <span className="text-[12px] text-[var(--ink)]">
              {artifact?.metadata.scenario_id ?? '—'} · {activeLabel}
            </span>
          </div>
          <div className="h-3 w-px bg-[var(--border-soft)]" />
          <div className="flex items-center gap-2">
            <span className="text-[10px] tracking-[0.04em] text-[var(--muted)]">
              Replay
            </span>
            <span className="max-w-[200px] truncate text-[12px] text-[var(--ink)] font-mono">
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

      <main className="flex-1 min-h-0 overflow-hidden pl-6 pr-0 py-3">
        <div className="grid h-full min-h-0 grid-cols-[200px_1fr_280px] gap-6">
          <aside className="flex min-h-0 flex-col gap-4 overflow-y-auto border-r border-[var(--border-soft)] pr-6 text-[var(--ink)]">
            <div className="pb-3">
              <div className="text-[11px] font-medium text-[var(--muted)]">
                Run Slots
              </div>
              <div className="mt-3 flex flex-col gap-2">
                {(['baseline', 'pressure'] as const).map((slot) => {
                  const isActive = slot === activeSlot
                  const isLoaded =
                    slot === 'baseline' ? baselineArtifact : pressureArtifact
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
              <div className="text-[11px] font-medium text-[var(--muted)]">
                Inspector
              </div>
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
            </div>

            <div className="relative border-t border-[var(--border-soft)] pt-4">
              <div className="text-[11px] font-medium text-[var(--muted)]">
                Replay Tools
              </div>
              <div className="mt-3 rounded-lg border border-[var(--border-soft)] bg-[var(--paper-soft)] px-3 py-2 text-[11px] text-[var(--ink)]">
                <div className="text-[10px] font-medium text-[var(--muted)]">
                  Replay ID
                </div>
                <div className="mt-1 truncate text-[12px] font-medium font-mono">
                  {artifact?.metadata.replay_id ?? '—'}
                </div>
              </div>
              <div className="relative mt-3 grid gap-2">
                <button
                  type="button"
                  onClick={() =>
                    artifact &&
                    handleCopy(artifact.metadata.replay_id, 'Replay ID')
                  }
                  className="rounded-md border border-[var(--border-soft)] bg-transparent px-3 py-2 text-[12px] font-medium text-[var(--muted)] transition-colors hover:border-[var(--accent-2)] hover:bg-[var(--paper-soft)] hover:text-[var(--ink)] disabled:cursor-not-allowed disabled:border-[var(--border-soft)] disabled:text-[var(--muted)]"
                  disabled={!artifact}
                >
                  Copy Replay ID
                </button>
                <button
                  type="button"
                  onClick={() =>
                    artifact &&
                    handleCopy(
                      buildReplayReference(artifact.metadata),
                      'Replay reference',
                    )
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
                      copyVisible
                        ? 'translate-y-0 opacity-100'
                        : 'translate-y-2 opacity-0'
                    }`}
                  >
                    {copyStatus}
                  </span>
                ) : null}
              </div>
            </div>
          </aside>

          <section className="flex min-h-0 flex-col">
            <div className="flex-1">
              {artifact ? (
                <FlowCanvas
                  artifact={artifact}
                  currentTick={currentTick}
                  animationDuration={animationDuration}
                  highlightedTokenId={selectedTokenId}
                  inspectorEnabled={inspectorEnabled}
                />
              ) : (
                <div className="canvas-grid relative h-full rounded-xl border border-[var(--border-soft)] bg-[var(--paper-soft)]">
                  <div className="max-w-sm px-6 pt-6 text-[13px] font-medium leading-relaxed text-[var(--muted)]">
                    {loadError ??
                      `Load the ${activeLabel.toLowerCase()} run artifact to start playback.`}
                  </div>
                </div>
              )}
            </div>
          </section>

          <aside className="flex min-h-0 flex-col overflow-hidden border-l border-[var(--border-soft)]">
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

      <footer className="border-t border-[var(--border-soft)] bg-transparent px-6 py-2">
        <div className="flex items-center gap-5">
          <button
            type="button"
            onClick={handleTogglePlay}
            className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm text-[var(--ink)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:border-[var(--border-soft)] disabled:text-[var(--muted)]"
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
