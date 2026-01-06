import { useMemo } from 'react'
import type { Artifact } from '../types'

export const useInspectorData = (artifact: Artifact | null, currentTick: number) => {
  const snapshot = useMemo(() => {
    if (!artifact) return null
    return artifact.snapshots[Math.min(currentTick, artifact.snapshots.length - 1)]
  }, [artifact, currentTick])

  const stateCounts = useMemo(() => {
    if (!snapshot) return null
    const counts = {
      queued: 0,
      processing: 0,
      done: 0,
      rejected: 0,
    }
    for (const token of snapshot.tokens) {
      if (token.state === 'queued') counts.queued += 1
      else if (token.state === 'processing') counts.processing += 1
      else if (token.state === 'done') counts.done += 1
      else if (token.state === 'rejected') counts.rejected += 1
    }
    return counts
  }, [snapshot])

  const reasonCounts = useMemo(() => {
    if (!artifact) return null
    const counts = new Map<string, number>()
    for (const event of artifact.events) {
      if (event.tick !== currentTick) continue
      counts.set(event.reason_code, (counts.get(event.reason_code) ?? 0) + 1)
    }
    return counts
  }, [artifact, currentTick])

  return { snapshot, stateCounts, reasonCounts }
}
