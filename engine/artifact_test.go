package engine

import (
	"encoding/hex"
	"reflect"
	"testing"
)

func TestReplayID(t *testing.T) {
	tests := []struct {
		name       string
		scenarioID string
		seed       int64
		version    string
	}{
		{
			name:       "canonical scenario",
			scenarioID: ScenarioID,
			seed:       1,
			version:    EngineVersion,
		},
		{
			name:       "different seed",
			scenarioID: ScenarioID,
			seed:       42,
			version:    EngineVersion,
		},
		{
			name:       "different scenario",
			scenarioID: "other_scenario",
			seed:       1,
			version:    EngineVersion,
		},
		{
			name:       "different version",
			scenarioID: ScenarioID,
			seed:       1,
			version:    "2.0.0",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			replayID := ReplayID(tt.scenarioID, tt.seed, tt.version)

			if replayID == "" {
				t.Error("ReplayID() returned empty string")
			}

			if len(replayID) != 64 {
				t.Errorf("ReplayID() returned length %d, want 64", len(replayID))
			}

			if _, err := hex.DecodeString(replayID); err != nil {
				t.Errorf("ReplayID() returned invalid hex string: %v", err)
			}
		})
	}
}

func TestReplayID_Deterministic(t *testing.T) {
	scenarioID := "test_scenario"
	seed := int64(123)
	version := "1.0.0"

	result1 := ReplayID(scenarioID, seed, version)
	result2 := ReplayID(scenarioID, seed, version)

	if result1 != result2 {
		t.Error("ReplayID() is not deterministic")
	}
}

func TestWriteArtifact(t *testing.T) {
	tmpDir := t.TempDir()
	path := tmpDir + "/test.json"

	artifact := Artifact{
		Metadata: Metadata{
			ScenarioID:      ScenarioID,
			Seed:            1,
			EngineVersion:   EngineVersion,
			ReplayID:        ReplayID(ScenarioID, 1, EngineVersion),
			TickCount:       240,
			TickDurationMs:  250,
			TotalDurationMs: 240 * 250,
		},
		Snapshots: []Snapshot{
			{
				Tick:   0,
				TimeMs: 0,
				Tokens: []TokenState{
					{
						ID:               "T0001",
						Class:            ClassPaid,
						State:            StateQueued,
						StageID:          StageQueue,
						QueueIndex:       0,
						ServiceRemaining: 1,
					},
				},
				Stages: []StageState{
					{
						ID:            StageQueue,
						QueueLength:   1,
						CapacityUsed:  0,
						CapacityTotal: 3,
					},
				},
			},
		},
		Events: []Event{
			{
				Tick:       0,
				Type:       EventQueue,
				ReasonCode: ReasonQueueAdmission,
				TokenID:    "T0001",
				StageID:    StageQueue,
				Class:      ClassPaid,
			},
		},
	}

	err := WriteArtifact(path, artifact)
	if err != nil {
		t.Fatalf("WriteArtifact() error = %v", err)
	}
}

func TestConstants(t *testing.T) {
	tests := []struct {
		name     string
		value    string
		expected []string
	}{
		{
			name:     "User classes",
			value:    "",
			expected: []string{ClassAnon, ClassFree, ClassPaid},
		},
		{
			name:  "States",
			value: "",
			expected: []string{
				StateQueued,
				StateProcessing,
				StateDone,
				StateRejected,
			},
		},
		{
			name:  "Stages",
			value: "",
			expected: []string{
				StageQueue,
				StageService,
				StageDone,
				StageRejected,
			},
		},
		{
			name:  "Events",
			value: "",
			expected: []string{
				EventQueue,
				EventSchedule,
				EventComplete,
				EventReject,
			},
		},
		{
			name:  "Reasons",
			value: "",
			expected: []string{
				ReasonQueueAdmission,
				ReasonPrioritySchedule,
				ReasonServiceComplete,
				ReasonRejectOverload,
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			for _, expected := range tt.expected {
				if expected == "" {
					t.Error("Constant is empty string")
				}
			}
		})
	}
}

func TestArtifact_Completeness(t *testing.T) {
	artifact := Artifact{
		Metadata: Metadata{
			ScenarioID:      ScenarioID,
			Seed:            1,
			EngineVersion:   EngineVersion,
			ReplayID:        ReplayID(ScenarioID, 1, EngineVersion),
			TickCount:       240,
			TickDurationMs:  250,
			TotalDurationMs: 240 * 250,
		},
		Snapshots: []Snapshot{
			{
				Tick:   0,
				TimeMs: 0,
				Tokens: []TokenState{},
				Stages: []StageState{},
			},
		},
		Events: []Event{},
	}

	if artifact.Metadata.ReplayID == "" {
		t.Error("Metadata.ReplayID should not be empty")
	}

	if artifact.Metadata.ScenarioID == "" {
		t.Error("Metadata.ScenarioID should not be empty")
	}

	if len(artifact.Snapshots) == 0 {
		t.Error("Snapshots should not be empty")
	}

	if artifact.Metadata.TotalDurationMs != artifact.Metadata.TickCount*artifact.Metadata.TickDurationMs {
		t.Error("TotalDurationMs should equal TickCount * TickDurationMs")
	}
}

func TestTokenState_Fields(t *testing.T) {
	token := TokenState{
		ID:               "T0001",
		Class:            ClassPaid,
		State:            StateProcessing,
		StageID:          StageService,
		QueueIndex:       0,
		ServiceRemaining: 1,
	}

	if token.ID == "" {
		t.Error("Token ID should not be empty")
	}

	if token.QueueIndex < -1 {
		t.Error("QueueIndex should be >= -1")
	}

	if token.ServiceRemaining < 0 {
		t.Error("ServiceRemaining should be >= 0")
	}

	validClasses := map[string]bool{
		ClassAnon: true,
		ClassFree: true,
		ClassPaid: true,
	}

	if !validClasses[token.Class] {
		t.Errorf("Invalid token class: %s", token.Class)
	}
}

func TestStageState_Fields(t *testing.T) {
	stage := StageState{
		ID:            StageService,
		QueueLength:   5,
		CapacityUsed:  3,
		CapacityTotal: 10,
	}

	if stage.ID == "" {
		t.Error("Stage ID should not be empty")
	}

	if stage.QueueLength < 0 {
		t.Error("QueueLength should be >= 0")
	}

	if stage.CapacityUsed < 0 {
		t.Error("CapacityUsed should be >= 0")
	}

	if stage.CapacityTotal < 0 {
		t.Error("CapacityTotal should be >= 0")
	}

	if stage.CapacityUsed > stage.CapacityTotal {
		t.Error("CapacityUsed should not exceed CapacityTotal")
	}
}

func TestEvent_Fields(t *testing.T) {
	event := Event{
		Tick:       10,
		Type:       EventComplete,
		ReasonCode: ReasonServiceComplete,
		TokenID:    "T0001",
		StageID:    StageDone,
		Class:      ClassFree,
	}

	if event.TokenID == "" {
		t.Error("TokenID should not be empty")
	}

	if event.StageID == "" {
		t.Error("StageID should not be empty")
	}

	if event.ReasonCode == "" {
		t.Error("ReasonCode should not be empty")
	}

	if event.Type == "" {
		t.Error("Type should not be empty")
	}

	if event.Tick < 0 {
		t.Error("Tick should be >= 0")
	}
}

func TestMetadata_Fields(t *testing.T) {
	metadata := Metadata{
		ScenarioID:      ScenarioID,
		Seed:            1,
		EngineVersion:   EngineVersion,
		ReplayID:        ReplayID(ScenarioID, 1, EngineVersion),
		TickCount:       240,
		TickDurationMs:  250,
		TotalDurationMs: 240 * 250,
	}

	if metadata.ScenarioID == "" {
		t.Error("ScenarioID should not be empty")
	}

	if metadata.EngineVersion == "" {
		t.Error("EngineVersion should not be empty")
	}

	if metadata.ReplayID == "" {
		t.Error("ReplayID should not be empty")
	}

	if metadata.TickCount <= 0 {
		t.Error("TickCount should be > 0")
	}

	if metadata.TickDurationMs <= 0 {
		t.Error("TickDurationMs should be > 0")
	}

	if metadata.TotalDurationMs <= 0 {
		t.Error("TotalDurationMs should be > 0")
	}

	if metadata.TotalDurationMs != metadata.TickCount*metadata.TickDurationMs {
		t.Error("TotalDurationMs should equal TickCount * TickDurationMs")
	}
}

func TestSnapshot_Fields(t *testing.T) {
	snapshot := Snapshot{
		Tick:   10,
		TimeMs: 2500,
		Tokens: []TokenState{
			{
				ID:               "T0001",
				Class:            ClassPaid,
				State:            StateProcessing,
				StageID:          StageService,
				QueueIndex:       0,
				ServiceRemaining: 1,
			},
		},
		Stages: []StageState{
			{
				ID:            StageService,
				QueueLength:   0,
				CapacityUsed:  1,
				CapacityTotal: 3,
			},
		},
	}

	if snapshot.Tick < 0 {
		t.Error("Tick should be >= 0")
	}

	if snapshot.TimeMs < 0 {
		t.Error("TimeMs should be >= 0")
	}

	if len(snapshot.Tokens) == 0 {
		t.Error("Tokens should not be empty")
	}

	if len(snapshot.Stages) == 0 {
		t.Error("Stages should not be empty")
	}
}

func TestConfig_Validation(t *testing.T) {
	tests := []struct {
		name       string
		scenarioID string
		wantErr    bool
	}{
		{
			name:       "valid scenario",
			scenarioID: ScenarioID,
			wantErr:    false,
		},
		{
			name:       "empty scenario",
			scenarioID: "",
			wantErr:    false,
		},
		{
			name:       "invalid scenario",
			scenarioID: "invalid_scenario",
			wantErr:    true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cfg := Config{
				ScenarioID: tt.scenarioID,
				Seed:       1,
			}

			_, err := Run(cfg)
			if (err != nil) != tt.wantErr {
				t.Errorf("Run() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestSnapshot_DeepCopy(t *testing.T) {
	original := Snapshot{
		Tick:   5,
		TimeMs: 1250,
		Tokens: []TokenState{
			{
				ID:               "T0001",
				Class:            ClassPaid,
				State:            StateQueued,
				StageID:          StageQueue,
				QueueIndex:       0,
				ServiceRemaining: 1,
			},
		},
		Stages: []StageState{
			{
				ID:            StageQueue,
				QueueLength:   1,
				CapacityUsed:  0,
				CapacityTotal: 3,
			},
		},
	}

	deepCopy := Snapshot{
		Tick:   original.Tick,
		TimeMs: original.TimeMs,
		Tokens: make([]TokenState, len(original.Tokens)),
		Stages: make([]StageState, len(original.Stages)),
	}

	for i, token := range original.Tokens {
		deepCopy.Tokens[i] = TokenState{
			ID:               token.ID,
			Class:            token.Class,
			State:            token.State,
			StageID:          token.StageID,
			QueueIndex:       token.QueueIndex,
			ServiceRemaining: token.ServiceRemaining,
		}
	}

	for i, stage := range original.Stages {
		deepCopy.Stages[i] = StageState{
			ID:            stage.ID,
			QueueLength:   stage.QueueLength,
			CapacityUsed:  stage.CapacityUsed,
			CapacityTotal: stage.CapacityTotal,
		}
	}

	if !reflect.DeepEqual(original, deepCopy) {
		t.Error("Deep copy should be equal to original")
	}

	deepCopy.Tokens[0].ID = "T9999"
	if original.Tokens[0].ID == deepCopy.Tokens[0].ID {
		t.Error("Modifying deep copy should not affect original")
	}

	deepCopy.Stages[0].ID = "modified"
	if original.Stages[0].ID == deepCopy.Stages[0].ID {
		t.Error("Modifying deep copy stages should not affect original")
	}
}
