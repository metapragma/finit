package engine

const (
	ScenarioID      = "canonical_v1"
	EngineVersion   = "0.1.0"
	TickRate        = 4
	TickCount       = 240
	TickDurationMs  = 250
	TotalDurationMs = TickCount * TickDurationMs
)

const (
	ClassAnon = "ANON"
	ClassFree = "FREE"
	ClassPaid = "PAID"
)

const (
	StateQueued     = "queued"
	StateProcessing = "processing"
	StateDone       = "done"
	StateRejected   = "rejected"
)

const (
	StageQueue    = "queue"
	StageService  = "service"
	StageDone     = "done"
	StageRejected = "rejected"
)

const (
	EventQueue    = "QUEUE"
	EventSchedule = "SCHEDULE"
	EventComplete = "COMPLETE"
	EventReject   = "REJECT"
)

const (
	ReasonQueueAdmission   = "QUEUE_ADMISSION"
	ReasonPrioritySchedule = "PRIORITY_SCHEDULE"
	ReasonServiceComplete  = "SERVICE_COMPLETE"
	ReasonRejectOverload   = "REJECT_OVERLOAD"
)

type Artifact struct {
	Metadata  Metadata   `json:"metadata"`
	Snapshots []Snapshot `json:"snapshots"`
	Events    []Event    `json:"events"`
}

type Metadata struct {
	ScenarioID      string `json:"scenario_id"`
	Seed            int64  `json:"seed"`
	EngineVersion   string `json:"engine_version"`
	ReplayID        string `json:"replay_id"`
	TickCount       int    `json:"tick_count"`
	TickDurationMs  int    `json:"tick_duration_ms"`
	TotalDurationMs int    `json:"total_duration_ms"`
}

type Snapshot struct {
	Tick   int          `json:"tick"`
	TimeMs int          `json:"time_ms"`
	Tokens []TokenState `json:"tokens"`
	Stages []StageState `json:"stages"`
}

type TokenState struct {
	ID               string `json:"id"`
	Class            string `json:"class"`
	State            string `json:"state"`
	StageID          string `json:"stage_id"`
	QueueIndex       int    `json:"queue_index"`
	ServiceRemaining int    `json:"service_remaining"`
}

type StageState struct {
	ID            string `json:"id"`
	QueueLength   int    `json:"queue_length"`
	CapacityUsed  int    `json:"capacity_used"`
	CapacityTotal int    `json:"capacity_total"`
}

type Event struct {
	Tick       int    `json:"tick"`
	Type       string `json:"type"`
	ReasonCode string `json:"reason_code"`
	TokenID    string `json:"token_id"`
	StageID    string `json:"stage_id"`
	Class      string `json:"class"`
}
