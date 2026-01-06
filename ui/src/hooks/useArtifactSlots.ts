import { useMemo, useState, type ChangeEvent } from 'react'
import { parseArtifact } from '../parseArtifact'
import type { Artifact } from '../types'

export type RunSlot = 'baseline' | 'pressure'

export const slotLabel = (slot: RunSlot) =>
  slot === 'baseline' ? 'Baseline' : 'High Pressure'

type UseArtifactSlotsArgs = {
  onSlotChange?: () => void
}

export const useArtifactSlots = ({ onSlotChange }: UseArtifactSlotsArgs = {}) => {
  const [baselineArtifact, setBaselineArtifact] = useState<Artifact | null>(null)
  const [pressureArtifact, setPressureArtifact] = useState<Artifact | null>(null)
  const [baselineError, setBaselineError] = useState<string | null>(null)
  const [pressureError, setPressureError] = useState<string | null>(null)
  const [activeSlot, setActiveSlot] = useState<RunSlot>('baseline')

  const scenarioGate = useMemo(
    () =>
      baselineArtifact?.metadata.scenario_id ??
      pressureArtifact?.metadata.scenario_id ??
      null,
    [baselineArtifact, pressureArtifact],
  )

  const artifact =
    activeSlot === 'baseline' ? baselineArtifact : pressureArtifact
  const loadError =
    activeSlot === 'baseline' ? baselineError : pressureError
  const activeLabel = slotLabel(activeSlot)

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
        onSlotChange?.()
      } catch (error) {
        setError('Unable to parse artifact JSON.')
      } finally {
        event.target.value = ''
      }
    }

  const handleSwitchSlot = (slot: RunSlot) => {
    setActiveSlot(slot)
    onSlotChange?.()
  }

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
