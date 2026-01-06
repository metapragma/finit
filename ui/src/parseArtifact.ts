import type { Artifact, Metadata, Snapshot, TokenClass, TokenState, StageState, Event } from './types'

type ParseResult = { ok: true; artifact: Artifact } | { ok: false; error: string }

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)

const isString = (value: unknown): value is string => typeof value === 'string'

const isArray = (value: unknown): value is unknown[] => Array.isArray(value)

const isTokenClass = (value: unknown): value is TokenClass =>
  value === 'ANON' || value === 'FREE' || value === 'PAID'

export function parseArtifact(data: unknown): ParseResult {
  if (!isRecord(data)) {
    return { ok: false, error: 'Artifact is not an object.' }
  }

  const metadata = data.metadata
  const snapshots = data.snapshots
  const events = data.events

  if (!isRecord(metadata)) {
    return { ok: false, error: 'Missing metadata.' }
  }

  const meta: Metadata = {
    scenario_id: isString(metadata.scenario_id) ? metadata.scenario_id : '',
    seed: isNumber(metadata.seed) ? metadata.seed : NaN,
    engine_version: isString(metadata.engine_version) ? metadata.engine_version : '',
    replay_id: isString(metadata.replay_id) ? metadata.replay_id : '',
    tick_count: isNumber(metadata.tick_count) ? metadata.tick_count : NaN,
    tick_duration_ms: isNumber(metadata.tick_duration_ms) ? metadata.tick_duration_ms : NaN,
    total_duration_ms: isNumber(metadata.total_duration_ms) ? metadata.total_duration_ms : NaN,
  }

  if (
    !meta.scenario_id ||
    !meta.engine_version ||
    !meta.replay_id ||
    !Number.isFinite(meta.seed) ||
    !Number.isFinite(meta.tick_count) ||
    !Number.isFinite(meta.tick_duration_ms)
  ) {
    return { ok: false, error: 'Metadata fields are missing or malformed.' }
  }

  if (!isArray(snapshots) || snapshots.length === 0) {
    return { ok: false, error: 'Snapshots missing or empty.' }
  }

  const parsedSnapshots: Snapshot[] = []
  for (const snapshot of snapshots) {
    if (!isRecord(snapshot)) {
      return { ok: false, error: 'Snapshot is not an object.' }
    }
    if (!isNumber(snapshot.tick) || !isNumber(snapshot.time_ms)) {
      return { ok: false, error: 'Snapshot tick or time_ms is invalid.' }
    }
    if (!isArray(snapshot.tokens) || !isArray(snapshot.stages)) {
      return { ok: false, error: 'Snapshot tokens or stages missing.' }
    }

    const tokens: TokenState[] = []
    for (const token of snapshot.tokens) {
      if (!isRecord(token)) {
        return { ok: false, error: 'Token entry is invalid.' }
      }
      if (
        !isString(token.id) ||
        !isTokenClass(token.class) ||
        !isString(token.state) ||
        !isString(token.stage_id) ||
        !isNumber(token.queue_index) ||
        !isNumber(token.service_remaining)
      ) {
        return { ok: false, error: 'Token fields are missing or malformed.' }
      }
      tokens.push({
        id: token.id,
        class: token.class,
        state: token.state,
        stage_id: token.stage_id,
        queue_index: token.queue_index,
        service_remaining: token.service_remaining,
      })
    }

    const stages: StageState[] = []
    for (const stage of snapshot.stages) {
      if (!isRecord(stage)) {
        return { ok: false, error: 'Stage entry is invalid.' }
      }
      if (
        !isString(stage.id) ||
        !isNumber(stage.queue_length) ||
        !isNumber(stage.capacity_used) ||
        !isNumber(stage.capacity_total)
      ) {
        return { ok: false, error: 'Stage fields are missing or malformed.' }
      }
      stages.push({
        id: stage.id,
        queue_length: stage.queue_length,
        capacity_used: stage.capacity_used,
        capacity_total: stage.capacity_total,
      })
    }

    parsedSnapshots.push({
      tick: snapshot.tick,
      time_ms: snapshot.time_ms,
      tokens,
      stages,
    })
  }

  const parsedEvents: Event[] = []
  if (isArray(events)) {
    for (const event of events) {
      if (!isRecord(event)) {
        return { ok: false, error: 'Event entry is invalid.' }
      }
      if (
        !isNumber(event.tick) ||
        !isString(event.type) ||
        !isString(event.reason_code) ||
        !isString(event.token_id) ||
        !isString(event.stage_id) ||
        !isString(event.class)
      ) {
        return { ok: false, error: 'Event fields are missing or malformed.' }
      }
      parsedEvents.push({
        tick: event.tick,
        type: event.type,
        reason_code: event.reason_code,
        token_id: event.token_id,
        stage_id: event.stage_id,
        class: event.class,
      })
    }
  }

  return {
    ok: true,
    artifact: {
      metadata: meta,
      snapshots: parsedSnapshots,
      events: parsedEvents,
    },
  }
}
