import { useEffect, useMemo, useState, type ChangeEvent } from 'react'
import type { Artifact } from '../types'

type UsePlaybackOptions = {
  playbackScale?: number
  resetKey?: string | number | null
}

export const usePlayback = (artifact: Artifact | null, options: UsePlaybackOptions = {}) => {
  const playbackScale = options.playbackScale ?? 3
  const resetKey = options.resetKey ?? null
  const [currentTick, setCurrentTick] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)

  const tickCount = artifact?.metadata.tick_count ?? 0
  const tickDuration = artifact?.metadata.tick_duration_ms ?? 250
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

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setCurrentTick(0)
    setIsPlaying(false)
  }, [artifact, resetKey])
  /* eslint-enable react-hooks/set-state-in-effect */

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

  return {
    animationDuration,
    currentTick,
    currentTime,
    handleScrub,
    handleTogglePlay,
    isPlaying,
    playbackInterval,
    setCurrentTick,
    setIsPlaying,
    tickCount,
    totalTime,
  }
}
