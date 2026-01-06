import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { parseArtifact } from '../parseArtifact'
import type { Artifact } from '../types'

export type RunSlot = 'baseline' | 'pressure'

export const slotLabel = (slot: RunSlot) => (slot === 'baseline' ? 'Baseline' : 'High Pressure')

type UseArtifactSlotsArgs = {
  onSlotChange?: () => void
  defaultArtifactUrl?: string
}

export const useArtifactSlots = ({ onSlotChange, defaultArtifactUrl }: UseArtifactSlotsArgs = {}) => {
  const [baselineArtifact, setBaselineArtifact] = useState<Artifact | null>(null)
  const [pressureArtifact, setPressureArtifact] = useState<Artifact | null>(null)
  const [baselineError, setBaselineError] = useState<string | null>(null)
  const [pressureError, setPressureError] = useState<string | null>(null)
  const [activeSlot, setActiveSlot] = useState<RunSlot>('baseline')
  const autoLoadRef = useRef(false)

  const scenarioGate = useMemo(
    () => baselineArtifact?.metadata.scenario_id ?? pressureArtifact?.metadata.scenario_id ?? null,
    [baselineArtifact, pressureArtifact],
  )

  const artifact = activeSlot === 'baseline' ? baselineArtifact : pressureArtifact
  const loadError = activeSlot === 'baseline' ? baselineError : pressureError
  const activeLabel = slotLabel(activeSlot)

  const loadSlotData = useCallback(
    (slot: RunSlot, data: unknown) => {
      const setError = slot === 'baseline' ? setBaselineError : setPressureError
      const setArtifact = slot === 'baseline' ? setBaselineArtifact : setPressureArtifact
      const result = parseArtifact(data)
      if (!result.ok) {
        setError(result.error)
        return false
      }

      if (scenarioGate && result.artifact.metadata.scenario_id !== scenarioGate) {
        setError('Scenario mismatch. MVP supports one scenario only.')
        return false
      }

      setArtifact(result.artifact)
      setError(null)
      setActiveSlot(slot)
      onSlotChange?.()
      return true
    },
    [onSlotChange, scenarioGate],
  )

  const handleFile = (slot: RunSlot) => (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.target
    const file = input.files?.[0]
    if (!file) return

    void (async () => {
      try {
        const text = await file.text()
        const json = JSON.parse(text) as unknown
        loadSlotData(slot, json)
      } catch {
        const setError = slot === 'baseline' ? setBaselineError : setPressureError
        setError('Unable to parse artifact JSON.')
      } finally {
        input.value = ''
      }
    })()
  }

  const handleSwitchSlot = (slot: RunSlot) => {
    setActiveSlot(slot)
    onSlotChange?.()
  }

  useEffect(() => {
    if (!defaultArtifactUrl || autoLoadRef.current || baselineArtifact) return
    autoLoadRef.current = true

    void (async () => {
      try {
        const response = await fetch(defaultArtifactUrl)
        if (!response.ok) {
          setBaselineError('Unable to load default artifact.')
          return
        }
        const data = (await response.json()) as unknown
        loadSlotData('baseline', data)
      } catch {
        setBaselineError('Unable to load default artifact.')
      }
    })()
  }, [baselineArtifact, defaultArtifactUrl, loadSlotData])

  return {
    activeLabel,
    activeSlot,
    artifact,
    baselineArtifact,
    loadError,
    handleFile,
    handleSwitchSlot,
    pressureArtifact,
  }
}
