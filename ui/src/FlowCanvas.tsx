import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import gsap from 'gsap'
import type { Artifact, TokenState } from './types'

type InspectorCounts = {
  queued: number
  processing: number
  done: number
  rejected: number
}

type FlowCanvasProps = {
  artifact: Artifact
  currentTick: number
  animationDuration: number
  highlightedTokenId?: string | null
  inspectorEnabled?: boolean
  flowLayout?: FlowLayout
  inspectorStateCounts?: InspectorCounts | null
  inspectorReasonCounts?: Map<string, number> | null
  showInspectorOverlay?: boolean
}

type Point = { x: number; y: number }

type StageAnchors = {
  queue: Point
  service: Point
  done: Point
  rejected: Point
}

type FlowLayout = 'horizontal' | 'vertical'

const STAGE_LABELS: Record<string, string> = {
  queue: 'Waiting',
  service: 'Active',
  done: 'Completed',
  rejected: 'Rejected',
}

const STAGE_ORDER = ['queue', 'service', 'done', 'rejected']

const gridUnit = 32

const stageBaseSizesDefault: Record<string, { width: number; height: number }> = {
  queue: { width: 192, height: 96 },
  service: { width: 192, height: 96 },
  done: { width: 288, height: 192 },
  rejected: { width: 288, height: 192 },
}

const stageBaseSizesVertical: Record<string, { width: number; height: number }> = {
  queue: { width: 168, height: 88 },
  service: { width: 168, height: 88 },
  done: { width: 160, height: 148 },
  rejected: { width: 160, height: 148 },
}

type StagePadding = {
  x: number
  bottom: number
  labelHeight: number
  labelTop: number
}

const stagePaddingDefault: StagePadding = {
  x: 20,
  bottom: 20,
  labelHeight: 18,
  labelTop: 12,
}

const stagePaddingVertical: StagePadding = {
  x: 16,
  bottom: 12,
  labelHeight: 16,
  labelTop: 10,
}

const tokenSize = 10

const queueGrid = { cols: 6, spacing: 14 }
const serviceGrid = { cols: 4, spacing: 16 }
const exitGrid = { cols: 4, spacing: 16 }
const queuedAlpha = 0.5
const emphasisGlow: Record<string, string> = {
  PRIORITY_SCHEDULE: 'rgba(37, 63, 93, 0.2)',
  REJECT_OVERLOAD: 'rgba(91, 101, 114, 0.2)',
}
const stageSurfaceClass = (stageId: string) => {
  switch (stageId) {
    case 'queue':
      return 'bg-[var(--stage-queue)]'
    case 'service':
      return 'bg-[var(--stage-service)]'
    case 'done':
      return 'bg-[var(--stage-done)]'
    case 'rejected':
      return 'bg-[var(--stage-rejected)]'
    default:
      return 'bg-[var(--surface)]'
  }
}

const stageLabelClass = (stageId: string) => {
  switch (stageId) {
    case 'service':
      return 'text-[11px] font-medium text-[var(--accent-2)]'
    case 'done':
      return 'text-[11px] font-medium text-[var(--ink)]'
    default:
      return 'text-[11px] font-medium text-[var(--muted)]'
  }
}

const stageRuleColor = (stageId: string) => {
  switch (stageId) {
    case 'service':
      return 'var(--accent-2)'
    case 'rejected':
      return 'var(--muted)'
    default:
      return 'var(--border)'
  }
}

const stageRuleOffset = (padding: StagePadding) => padding.labelTop + padding.labelHeight + 4

const tokenClassName = (tokenClass: string) => {
  switch (tokenClass) {
    case 'ANON':
      return 'border border-dashed border-[var(--token-anon-border)] bg-[var(--token-anon)]'
    case 'PAID':
      return 'border-2 border-[var(--token-paid-border)] bg-[var(--token-paid)] shadow-[0_0_0_2px_rgba(37,63,93,0.16)]'
    default:
      return 'border border-[var(--token-free-border)] bg-transparent'
  }
}

const motionProfile = (tokenState: TokenState | undefined, animationDuration: number) => {
  if (!tokenState) {
    return { duration: animationDuration, delay: 0 }
  }

  const durationScale = tokenState.class === 'PAID' ? 0.6 : tokenState.class === 'FREE' ? 0.8 : 1
  const waitDelay = tokenState.state === 'queued' ? animationDuration * 0.35 : 0
  const available = Math.max(animationDuration - waitDelay, animationDuration * 0.45)
  const duration = Math.max(0.12, Math.min(available * durationScale, animationDuration))

  return { duration, delay: waitDelay }
}

const stageAnchorsFromSize = (
  width: number,
  height: number,
  flowLayout: FlowLayout,
  stageSizes: Record<string, { width: number; height: number }>,
): StageAnchors => {
  const margin = gridUnit / 2

  if (flowLayout === 'vertical') {
    const queueSize = stageSizes.queue
    const serviceSize = stageSizes.service
    const doneSize = stageSizes.done
    const rejectedSize = stageSizes.rejected
    const minGap = gridUnit / 4
    const rowHeight = Math.max(doneSize.height, rejectedSize.height)
    const columnX = snapToGrid(width / 2)
    const top = margin
    const bottom = height - margin
    const rowY = bottom - rowHeight / 2
    const rowTop = rowY - rowHeight / 2
    const gapBudget = Math.max(0, rowTop - top - queueSize.height - serviceSize.height)
    let gap1 = gapBudget * 0.35
    let gap2 = gapBudget * 0.65
    if (gapBudget >= minGap * 2) {
      gap1 = Math.max(minGap, gap1)
      gap2 = Math.max(minGap, gap2)
      const total = gap1 + gap2
      if (total > gapBudget) {
        const scale = gapBudget / total
        gap1 *= scale
        gap2 *= scale
      }
    }

    const serviceY = rowTop - gap2 - serviceSize.height / 2
    const queueY = serviceY - gap1 - (queueSize.height + serviceSize.height) / 2

    const availableWidth = width - margin * 2
    const baseRowWidth = doneSize.width + rejectedSize.width
    const gapX = Math.max(0, Math.min(gridUnit * 0.6, (availableWidth - baseRowWidth) / 2))
    const totalRowWidth = baseRowWidth + gapX
    const startX = (width - totalRowWidth) / 2
    const doneX = startX + doneSize.width / 2
    const rejectedX = doneX + doneSize.width / 2 + gapX + rejectedSize.width / 2

    return {
      queue: { x: columnX, y: queueY },
      service: { x: columnX, y: serviceY },
      done: { x: doneX, y: rowY },
      rejected: { x: rejectedX, y: rowY },
    }
  }

  const minGap = gridUnit / 4
  const queueSize = stageSizes.queue
  const serviceSize = stageSizes.service
  const rightWidth = Math.max(stageSizes.done.width, stageSizes.rejected.width)

  const rowY = clamp(
    snapToGrid(height * 0.52),
    queueSize.height / 2 + gridUnit,
    height - queueSize.height / 2 - gridUnit,
  )

  const available = width - margin * 2
  const baseTotal = queueSize.width + serviceSize.width + rightWidth
  const horizontalGap = Math.max(minGap, Math.floor((available - baseTotal) / 2))
  const leftX = queueSize.width / 2 + margin
  const maxRightX = width - rightWidth / 2 - margin

  let serviceX = leftX + (queueSize.width + serviceSize.width) / 2 + horizontalGap
  let rightX = serviceX + (serviceSize.width + rightWidth) / 2 + horizontalGap

  if (rightX > maxRightX) {
    const shift = rightX - maxRightX
    serviceX -= shift
    const minServiceX = leftX + (queueSize.width + serviceSize.width) / 2 + minGap
    if (serviceX < minServiceX) {
      serviceX = minServiceX
      rightX = Math.min(maxRightX, serviceX + (serviceSize.width + rightWidth) / 2 + minGap)
    } else {
      rightX = maxRightX
    }
  }

  const queue = {
    x: snapToGrid(leftX),
    y: rowY,
  }
  const service = {
    x: snapToGrid(serviceX),
    y: rowY,
  }
  rightX = snapToGrid(rightX)
  const doneHalf = stageSizes.done.height / 2
  const rejectedHalf = stageSizes.rejected.height / 2
  const minVerticalGap = doneHalf + rejectedHalf + gridUnit
  const maxGap = height - (doneHalf + rejectedHalf + gridUnit * 4)
  const desiredGap = doneHalf + rejectedHalf + gridUnit * 3
  const verticalGap = snapToGrid(Math.max(minVerticalGap, Math.min(desiredGap, maxGap)))
  const columnCenter = snapToGrid(height * 0.52)

  let doneY = columnCenter - verticalGap / 2
  let rejectedY = columnCenter + verticalGap / 2

  const serviceBottom = service.y + stageSizes.service.height / 2 + gridUnit
  const t = (service.x - queue.x) / (rightX - queue.x)
  if (t > 0 && t < 1) {
    const lineY = queue.y + (rejectedY - queue.y) * t
    if (lineY < serviceBottom) {
      const shift = serviceBottom - lineY
      doneY += shift
      rejectedY += shift
    }
  }

  const minTop = doneHalf + gridUnit
  const maxBottom = height - rejectedHalf - gridUnit

  if (doneY < minTop) {
    const shift = minTop - doneY
    doneY += shift
    rejectedY += shift
  }

  if (rejectedY > maxBottom) {
    const shift = rejectedY - maxBottom
    doneY -= shift
    rejectedY -= shift
  }

  return {
    queue,
    service,
    done: { x: rightX, y: doneY },
    rejected: { x: rightX, y: rejectedY },
  }
}

const positionForGrid = (index: number, cols: number, spacing: number) => {
  const col = index % cols
  const row = Math.floor(index / cols)
  return {
    x: col * spacing,
    y: row * spacing,
  }
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

const snapToGrid = (value: number) => Math.round(value / gridUnit) * gridUnit

type StageLayout = {
  id: string
  center: Point
  size: { width: number; height: number }
  origin: Point
  contentOrigin: Point
  contentSize: { width: number; height: number }
  grid: { cols: number; spacing: number }
  rows: number
  capacity: number
  padding: StagePadding
}

const resolveFlowLayout = (width: number, height: number): FlowLayout => {
  if (width === 0 || height === 0) return 'horizontal'
  return width < 520 ? 'vertical' : 'horizontal'
}

const resolveStageSizes = (
  flowLayout: FlowLayout,
  canvasSize: { width: number; height: number },
) => {
  if (flowLayout === 'horizontal') {
    return stageBaseSizesDefault
  }

  const base = stageBaseSizesVertical
  const margin = gridUnit / 2
  const availableWidth = Math.max(canvasSize.width - margin * 2, 0)
  const availableHeight = Math.max(canvasSize.height - margin * 2, 0)
  const minGapX = gridUnit / 6
  const rowWidth = base.done.width + base.rejected.width + minGapX
  const rowHeight = Math.max(base.done.height, base.rejected.height)
  const minGap = gridUnit / 4
  const baseTotalHeight = base.queue.height + base.service.height + rowHeight + minGap * 2
  const widthScale = rowWidth > 0 ? Math.min(1, availableWidth / rowWidth) : 1
  const heightScale = baseTotalHeight > 0 ? Math.min(1, availableHeight / baseTotalHeight) : 1
  const scale = clamp(Math.min(widthScale, heightScale), 0.6, 1.05)

  return {
    queue: {
      width: Math.round(base.queue.width * scale),
      height: Math.round(base.queue.height * scale),
    },
    service: {
      width: Math.round(base.service.width * scale),
      height: Math.round(base.service.height * scale),
    },
    done: {
      width: Math.round(base.done.width * scale),
      height: Math.round(base.done.height * scale),
    },
    rejected: {
      width: Math.round(base.rejected.width * scale),
      height: Math.round(base.rejected.height * scale),
    },
  }
}

const connectionLine = (from: StageLayout, to: StageLayout, flowLayout: FlowLayout) => {
  if (flowLayout === 'vertical') {
    return {
      x1: from.center.x,
      y1: from.center.y + from.size.height / 2,
      x2: to.center.x,
      y2: to.center.y - to.size.height / 2,
    }
  }

  return {
    x1: from.center.x + from.size.width / 2,
    y1: from.center.y,
    x2: to.center.x - to.size.width / 2,
    y2: to.center.y,
  }
}

const buildTokenPositions = (
  tokens: { id: string; class: string }[],
  tokenStateMap: Map<string, TokenState>,
  stageIndex: Map<string, number>,
  stageLayouts: Record<string, StageLayout>,
  alphaMap: Map<string, number>,
) => {
  const positions = new Map<string, { x: number; y: number; visible: boolean; alpha: number }>()

  for (const token of tokens) {
    const state = tokenStateMap.get(token.id)
    if (!state) {
      positions.set(token.id, { x: 0, y: 0, visible: false, alpha: 0 })
      continue
    }

    const layout = stageLayouts[state.stage_id]
    if (!layout) {
      positions.set(token.id, { x: 0, y: 0, visible: false, alpha: 0 })
      continue
    }

    const index =
      state.stage_id === 'queue' && state.queue_index >= 0
        ? state.queue_index
        : (stageIndex.get(state.id) ?? 0)

    const grid = positionForGrid(index, layout.grid.cols, layout.grid.spacing)

    const alpha = alphaMap.get(token.id) ?? 1

    positions.set(token.id, {
      x: layout.contentOrigin.x + grid.x,
      y: layout.contentOrigin.y + grid.y,
      visible: true,
      alpha,
    })
  }

  return positions
}

export const FlowCanvas = ({
  artifact,
  currentTick,
  animationDuration,
  highlightedTokenId,
  inspectorEnabled = false,
  flowLayout,
  inspectorStateCounts,
  inspectorReasonCounts,
  showInspectorOverlay = false,
}: FlowCanvasProps) => {
  const canvasRef = useRef<HTMLDivElement | null>(null)
  const tokenRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 })
  const initializedRef = useRef(false)
  const flowTimelineRef = useRef<gsap.core.Timeline | null>(null)
  const emphasisTimelineRef = useRef<gsap.core.Timeline | null>(null)
  const emphasisTokenIdsRef = useRef<string[]>([])

  const snapshot = artifact.snapshots[Math.min(currentTick, artifact.snapshots.length - 1)]

  const stageStates = useMemo(() => {
    const map = new Map<string, { queue: number; used: number; total: number }>()
    for (const stage of snapshot.stages) {
      map.set(stage.id, {
        queue: stage.queue_length,
        used: stage.capacity_used,
        total: stage.capacity_total,
      })
    }
    return map
  }, [snapshot])

  const emphasisTokens = useMemo(() => {
    const map = new Map<string, string>()
    const queueDepth = stageStates.get('queue')?.queue ?? 0

    for (const event of artifact.events) {
      if (event.tick !== currentTick) continue
      if (event.reason_code === 'PRIORITY_SCHEDULE') {
        if (queueDepth > 0) {
          map.set(event.token_id, emphasisGlow.PRIORITY_SCHEDULE)
        }
      } else if (event.reason_code === 'REJECT_OVERLOAD') {
        map.set(event.token_id, emphasisGlow.REJECT_OVERLOAD)
      }
    }

    return map
  }, [artifact, currentTick, stageStates])

  const tokenCatalog = useMemo(() => {
    const map = new Map<string, string>()
    for (const snap of artifact.snapshots) {
      for (const token of snap.tokens) {
        if (!map.has(token.id)) {
          map.set(token.id, token.class)
        }
      }
    }
    return Array.from(map, ([id, tokenClass]) => ({ id, class: tokenClass }))
  }, [artifact])

  const highlightSegments = useMemo(() => {
    if (!highlightedTokenId)
      return [] as Array<{
        from: string
        to: string
      }>

    let lastStage: string | null = null
    const stages: string[] = []

    for (const snap of artifact.snapshots) {
      const token = snap.tokens.find((item) => item.id === highlightedTokenId)
      if (!token) continue
      if (token.stage_id !== lastStage) {
        stages.push(token.stage_id)
        lastStage = token.stage_id
      }
    }

    const segments: Array<{ from: string; to: string }> = []
    for (let i = 0; i < stages.length - 1; i += 1) {
      segments.push({ from: stages[i], to: stages[i + 1] })
    }

    return segments
  }, [artifact, highlightedTokenId])

  const exitEntryTicks = useMemo(() => {
    const entries = new Map<string, { stage: string; tick: number }>()
    for (const snap of artifact.snapshots) {
      for (const token of snap.tokens) {
        if (
          (token.stage_id === 'done' || token.stage_id === 'rejected') &&
          !entries.has(token.id)
        ) {
          entries.set(token.id, { stage: token.stage_id, tick: snap.tick })
        }
      }
    }
    return entries
  }, [artifact])

  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = {
      queue: 0,
      service: 0,
      done: 0,
      rejected: 0,
    }

    for (const token of snapshot.tokens) {
      if (counts[token.stage_id] !== undefined) {
        counts[token.stage_id] += 1
      }
    }

    return counts
  }, [snapshot])

  const resolvedFlowLayout = useMemo(
    () => flowLayout ?? resolveFlowLayout(canvasSize.width, canvasSize.height),
    [canvasSize, flowLayout],
  )
  const stageSizes = useMemo(
    () => resolveStageSizes(resolvedFlowLayout, canvasSize),
    [resolvedFlowLayout, canvasSize],
  )
  const stagePadding = useMemo(
    () => (resolvedFlowLayout === 'vertical' ? stagePaddingVertical : stagePaddingDefault),
    [resolvedFlowLayout],
  )
  const ruleOffset = useMemo(() => stageRuleOffset(stagePadding), [stagePadding])
  const anchors = useMemo(
    () => stageAnchorsFromSize(canvasSize.width, canvasSize.height, resolvedFlowLayout, stageSizes),
    [canvasSize, resolvedFlowLayout, stageSizes],
  )

  const stageLayouts = useMemo(() => {
    const layouts: Record<string, StageLayout> = {}

    for (const stageId of STAGE_ORDER) {
      const size = stageSizes[stageId] ?? stageSizes.queue
      const grid = stageId === 'queue' ? queueGrid : stageId === 'service' ? serviceGrid : exitGrid
      const padding = stagePadding
      const tokenTopOffset = padding.labelTop + padding.labelHeight + padding.bottom
      const contentHeight = size.height - tokenTopOffset - padding.bottom
      const contentWidth = size.width - padding.x * 2
      let spacing = grid.spacing
      let cols = grid.cols
      let rows = 1

      if (stageId === 'done' || stageId === 'rejected') {
        cols = Math.max(1, Math.floor((contentWidth - tokenSize) / grid.spacing) + 1)
        if (cols > 1) {
          spacing = (contentWidth - tokenSize) / (cols - 1)
        }
        rows = Math.max(1, Math.floor((contentHeight - tokenSize) / spacing) + 1)
      } else {
        const count = stageCounts[stageId] ?? 0
        rows = Math.max(1, Math.ceil(count / cols))
      }

      const center = anchors[stageId as keyof StageAnchors]
      const desiredOrigin = {
        x: center.x - size.width / 2,
        y: center.y - size.height / 2,
      }
      const origin = {
        x:
          resolvedFlowLayout === 'vertical'
            ? clamp(
                desiredOrigin.x,
                gridUnit / 2,
                Math.max(gridUnit / 2, canvasSize.width - size.width - gridUnit / 2),
              )
            : clamp(
                snapToGrid(desiredOrigin.x),
                gridUnit,
                Math.max(gridUnit, canvasSize.width - size.width - gridUnit),
              ),
        y:
          resolvedFlowLayout === 'vertical'
            ? clamp(
                desiredOrigin.y,
                gridUnit / 2,
                Math.max(gridUnit / 2, canvasSize.height - size.height - gridUnit / 2),
              )
            : clamp(
                snapToGrid(desiredOrigin.y),
                gridUnit,
                Math.max(gridUnit, canvasSize.height - size.height - gridUnit),
              ),
      }

      const snappedCenter = {
        x: origin.x + size.width / 2,
        y: origin.y + size.height / 2,
      }

      const contentOrigin = {
        x: origin.x + padding.x,
        y: origin.y + tokenTopOffset,
      }

      layouts[stageId] = {
        id: stageId,
        center: snappedCenter,
        size,
        origin,
        contentOrigin,
        contentSize: {
          width: contentWidth,
          height: contentHeight,
        },
        grid: { cols, spacing },
        rows,
        capacity: rows * cols,
        padding,
      }
    }

    return layouts
  }, [anchors, canvasSize.height, canvasSize.width, stageCounts, stagePadding, stageSizes])

  const { tokenStateMap, stageIndexMap, visibleTokenIds, alphaMap } = useMemo(() => {
    const tokenMap = new Map<string, TokenState>()
    const stageIndex = new Map<string, number>()
    const alpha = new Map<string, number>()
    const visibleIds = new Set<string>()
    const grouped: Record<string, TokenState[]> = {
      queue: [],
      service: [],
      done: [],
      rejected: [],
    }

    for (const token of snapshot.tokens) {
      tokenMap.set(token.id, token)
      if (grouped[token.stage_id]) {
        grouped[token.stage_id].push(token)
      }
    }

    grouped.queue.sort((a, b) => a.queue_index - b.queue_index || a.id.localeCompare(b.id))
    grouped.queue.forEach((token, idx) => {
      stageIndex.set(token.id, idx)
      visibleIds.add(token.id)
      alpha.set(token.id, queuedAlpha)
    })

    grouped.service.sort((a, b) => a.id.localeCompare(b.id))
    grouped.service.forEach((token, idx) => {
      stageIndex.set(token.id, idx)
      visibleIds.add(token.id)
      alpha.set(token.id, 1)
    })

    for (const stageId of ['done', 'rejected'] as const) {
      const layout = stageLayouts[stageId]
      const cols = layout.grid.cols
      const rows = layout.rows
      const ordered = [...grouped[stageId]].sort((a, b) => {
        const aTick = exitEntryTicks.get(a.id)?.tick ?? 0
        const bTick = exitEntryTicks.get(b.id)?.tick ?? 0
        if (aTick !== bTick) return aTick - bTick
        return a.id.localeCompare(b.id)
      })

      const groups: TokenState[][] = []
      for (let i = 0; i < ordered.length; i += cols) {
        groups.push(ordered.slice(i, i + cols))
      }

      const overflow = groups.length > rows
      const start = Math.max(0, groups.length - rows)
      const visibleGroups = groups.slice(start)
      const rowOffset = Math.max(0, rows - visibleGroups.length)

      visibleGroups.forEach((group, groupIdx) => {
        const row = rowOffset + groupIdx
        group.forEach((token, colIdx) => {
          const idx = row * cols + colIdx
          stageIndex.set(token.id, idx)
          visibleIds.add(token.id)
          alpha.set(token.id, overflow && row === rowOffset ? 0.35 : 1)
        })
      })
    }

    return {
      tokenStateMap: tokenMap,
      stageIndexMap: stageIndex,
      visibleTokenIds: visibleIds,
      alphaMap: alpha,
    }
  }, [exitEntryTicks, snapshot, stageLayouts])

  useLayoutEffect(() => {
    if (!canvasRef.current) return

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        setCanvasSize({ width, height })
      }
    })

    observer.observe(canvasRef.current)
    return () => observer.disconnect()
  }, [])

  useLayoutEffect(() => {
    if (!canvasRef.current || canvasSize.width === 0) return

    const positions = buildTokenPositions(
      tokenCatalog,
      tokenStateMap,
      stageIndexMap,
      stageLayouts,
      alphaMap,
    )

    if (!initializedRef.current) {
      for (const token of tokenCatalog) {
        const el = tokenRefs.current[token.id]
        const pos = positions.get(token.id)
        if (!el || !pos || !visibleTokenIds.has(token.id)) {
          if (el) {
            gsap.set(el, { autoAlpha: 0 })
          }
          continue
        }
        gsap.set(el, {
          x: pos.x,
          y: pos.y,
          autoAlpha: pos.visible ? pos.alpha : 0,
        })
      }
      initializedRef.current = true
      return
    }

    if (flowTimelineRef.current) {
      flowTimelineRef.current.kill()
    }

    const timeline = gsap.timeline({
      defaults: { ease: 'sine.inOut', overwrite: 'auto' },
    })

    for (const token of tokenCatalog) {
      const el = tokenRefs.current[token.id]
      const pos = positions.get(token.id)
      if (!el || !pos || !visibleTokenIds.has(token.id)) {
        if (el) {
          gsap.set(el, { autoAlpha: 0 })
        }
        continue
      }

      const motion = motionProfile(tokenStateMap.get(token.id), animationDuration)

      timeline.to(
        el,
        {
          x: pos.x,
          y: pos.y,
          autoAlpha: pos.visible ? pos.alpha : 0,
          duration: motion.duration,
          delay: motion.delay,
        },
        0,
      )
    }

    flowTimelineRef.current = timeline
  }, [
    animationDuration,
    canvasSize.width,
    stageIndexMap,
    stageLayouts,
    tokenCatalog,
    tokenStateMap,
    visibleTokenIds,
    alphaMap,
  ])

  useLayoutEffect(() => {
    if (!initializedRef.current) return

    if (emphasisTimelineRef.current) {
      emphasisTimelineRef.current.kill()
    }

    if (emphasisTokenIdsRef.current.length > 0) {
      for (const tokenId of emphasisTokenIdsRef.current) {
        const el = tokenRefs.current[tokenId]
        if (el) {
          gsap.set(el, { filter: 'drop-shadow(0 0 0 rgba(0, 0, 0, 0))' })
        }
      }
    }

    const entries = Array.from(emphasisTokens.entries())
    emphasisTokenIdsRef.current = entries.map(([tokenId]) => tokenId)
    if (entries.length === 0) return

    const timeline = gsap.timeline({
      defaults: { ease: 'sine.out', overwrite: 'none' },
    })

    for (const [tokenId, glow] of entries) {
      const el = tokenRefs.current[tokenId]
      if (!el) continue
      timeline.fromTo(
        el,
        { filter: 'drop-shadow(0 0 0 rgba(0, 0, 0, 0))' },
        { filter: `drop-shadow(0 0 6px ${glow})`, duration: 0.35 },
        0,
      )
      timeline.to(el, { filter: 'drop-shadow(0 0 0 rgba(0, 0, 0, 0))', duration: 0.45 }, 0.35)
    }

    emphasisTimelineRef.current = timeline
  }, [emphasisTokens])

  return (
    <div
      ref={canvasRef}
      className="canvas-grid relative h-full min-h-[40vh] w-full overflow-hidden rounded-xl border border-[var(--border-soft)] bg-[var(--paper-soft)] sm:min-h-[60vh] md:min-h-[62vh] lg:min-h-0"
    >
      <svg className="absolute inset-0 h-full w-full">
        <defs>
          <marker
            id="flow-arrow"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="5"
            markerHeight="5"
            orient="auto"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--border)" />
          </marker>
          <marker
            id="flow-arrow-muted"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="5"
            markerHeight="5"
            orient="auto"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--border)" />
          </marker>
          <marker
            id="flow-arrow-strong"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="5"
            markerHeight="5"
            orient="auto"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--accent)" />
          </marker>
        </defs>
        {highlightSegments.map((segment) => {
          const from = stageLayouts[segment.from]
          const to = stageLayouts[segment.to]
          if (!from || !to) return null
          const coords = connectionLine(from, to, resolvedFlowLayout)
          return (
            <line
              key={`${segment.from}-${segment.to}`}
              x1={coords.x1}
              y1={coords.y1}
              x2={coords.x2}
              y2={coords.y2}
              stroke="var(--accent)"
              strokeWidth="1.5"
              strokeOpacity="0.35"
              strokeLinecap="round"
              markerEnd="url(#flow-arrow-strong)"
            />
          )
        })}
        {(() => {
          const coords = connectionLine(
            stageLayouts.queue,
            stageLayouts.service,
            resolvedFlowLayout,
          )
          return (
            <line
              x1={coords.x1}
              y1={coords.y1}
              x2={coords.x2}
              y2={coords.y2}
              stroke="var(--border)"
              strokeWidth="1"
              strokeLinecap="round"
              markerEnd="url(#flow-arrow)"
            />
          )
        })()}
        {(() => {
          const coords = connectionLine(stageLayouts.service, stageLayouts.done, resolvedFlowLayout)
          return (
            <line
              x1={coords.x1}
              y1={coords.y1}
              x2={coords.x2}
              y2={coords.y2}
              stroke="var(--border)"
              strokeWidth="1"
              strokeLinecap="round"
              markerEnd="url(#flow-arrow)"
            />
          )
        })()}
        {resolvedFlowLayout === 'vertical' ? (
          <line
            x1={stageLayouts.queue.center.x}
            y1={stageLayouts.queue.center.y + stageLayouts.queue.size.height / 2}
            x2={stageLayouts.rejected.center.x}
            y2={stageLayouts.rejected.center.y - stageLayouts.rejected.size.height / 2}
            stroke="var(--border)"
            strokeWidth="1.25"
            strokeOpacity="0.85"
            strokeDasharray="4 6"
            strokeLinecap="round"
            markerEnd="url(#flow-arrow-muted)"
          />
        ) : (
          <line
            x1={stageLayouts.queue.center.x + stageLayouts.queue.size.width / 2}
            y1={stageLayouts.queue.center.y}
            x2={stageLayouts.rejected.center.x - stageLayouts.rejected.size.width / 2}
            y2={stageLayouts.rejected.center.y}
            stroke="var(--border)"
            strokeWidth="1.25"
            strokeOpacity="0.85"
            strokeDasharray="4 6"
            strokeLinecap="round"
            markerEnd="url(#flow-arrow-muted)"
          />
        )}
      </svg>

      {STAGE_ORDER.map((stageId) => {
        const layout = stageLayouts[stageId]
        const label = STAGE_LABELS[stageId] ?? stageId
        let badgeText: string | null = null
        if (inspectorEnabled) {
          const stage = stageStates.get(stageId)
          if (stageId === 'queue') {
            badgeText = `queue ${stage?.queue ?? 0}`
          } else if (stageId === 'service') {
            badgeText = `capacity ${stage?.used ?? 0}/${stage?.total ?? 0}`
          } else if (stageId === 'done') {
            badgeText = `count ${stageCounts.done}`
          } else if (stageId === 'rejected') {
            badgeText = `count ${stageCounts.rejected}`
          }
        }
        return (
          <div
            key={stageId}
            className={`absolute rounded-2xl border border-[var(--border)] px-4 py-3 text-sm font-medium text-[var(--ink)] shadow-[0_1px_0_rgba(16,20,28,0.04)] ${stageSurfaceClass(stageId)}`}
            style={{
              width: layout.size.width,
              height: layout.size.height,
              left: layout.origin.x,
              top: layout.origin.y,
            }}
          >
            <div className={stageLabelClass(stageId)}>{label}</div>
            {resolvedFlowLayout === 'horizontal' ? (
              <div
                className="absolute left-4 right-4 h-px opacity-60"
                style={{
                  top: ruleOffset,
                  backgroundColor: stageRuleColor(stageId),
                }}
              />
            ) : null}
            {badgeText ? (
              <span className="absolute right-3 top-2 rounded-full border border-[var(--border-soft)] bg-[var(--paper-soft)] px-2 py-0.5 text-[10px] font-medium text-[var(--muted)]">
                {badgeText}
              </span>
            ) : null}
          </div>
        )
      })}

      <div className="absolute inset-0">
        {tokenCatalog.map((token) => (
          <div
            key={token.id}
            ref={(el) => {
              tokenRefs.current[token.id] = el
            }}
            className={`absolute rounded-full ${
              token.id === highlightedTokenId ? 'ring-2 ring-[var(--ink)]' : ''
            } ${tokenClassName(token.class)}`}
            style={{ width: tokenSize, height: tokenSize }}
          />
        ))}
      </div>

      {inspectorEnabled && showInspectorOverlay && inspectorStateCounts ? (
        <div className="absolute left-4 top-4 w-56 rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] px-3 py-3 text-xs text-[var(--ink)]">
          <div className="text-[10px] font-medium text-[var(--muted)]">Inspector</div>
          <div className="mt-2 space-y-1">
            <div>Queued: {inspectorStateCounts.queued}</div>
            <div>Processing: {inspectorStateCounts.processing}</div>
            <div>Done: {inspectorStateCounts.done}</div>
            <div>Rejected: {inspectorStateCounts.rejected}</div>
          </div>
          <div className="mt-3 border-t border-[var(--border-soft)] pt-2">
            <div className="text-[10px] font-medium text-[var(--muted)]">
              Reasons @ tick {currentTick}
            </div>
            {inspectorReasonCounts && inspectorReasonCounts.size === 0 ? (
              <div className="mt-1 text-[11px] text-[var(--muted)]">No events</div>
            ) : (
              <div className="mt-1 space-y-1 text-[11px]">
                {Array.from(inspectorReasonCounts ?? []).map(([reason, count]) => (
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
  )
}
