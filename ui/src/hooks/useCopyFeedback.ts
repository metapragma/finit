import { useEffect, useRef, useState } from 'react'

export const useCopyFeedback = () => {
  const [copyStatus, setCopyStatus] = useState<string | null>(null)
  const [copyVisible, setCopyVisible] = useState(false)
  const hideTimer = useRef<number | null>(null)
  const clearTimer = useRef<number | null>(null)

  const showStatus = (label: string) => {
    setCopyStatus(label)
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

  const handleCopy = (value: string, label: string) => {
    void (async () => {
      try {
        await navigator.clipboard.writeText(value)
        showStatus(`${label} copied`)
      } catch {
        showStatus('Copy failed')
      }
    })()
  }

  useEffect(() => {
    return () => {
      if (hideTimer.current) window.clearTimeout(hideTimer.current)
      if (clearTimer.current) window.clearTimeout(clearTimer.current)
    }
  }, [])

  return {
    copyStatus,
    copyVisible,
    handleCopy,
  }
}
