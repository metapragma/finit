export type TokenClass = 'ANON' | 'FREE' | 'PAID'

export type Metadata = {
  scenario_id: string
  seed: number
  engine_version: string
  replay_id: string
  tick_count: number
  tick_duration_ms: number
  total_duration_ms: number
}

export type TokenState = {
  id: string
  class: TokenClass | string
  state: string
  stage_id: string
  queue_index: number
  service_remaining: number
}

export type StageState = {
  id: string
  queue_length: number
  capacity_used: number
  capacity_total: number
}

export type Snapshot = {
  tick: number
  time_ms: number
  tokens: TokenState[]
  stages: StageState[]
}

export type Event = {
  tick: number
  type: string
  reason_code: string
  token_id: string
  stage_id: string
  class: string
}

export type Artifact = {
  metadata: Metadata
  snapshots: Snapshot[]
  events: Event[]
}

