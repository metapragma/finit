package engine

import (
	"errors"
	"fmt"
	"math/rand"
)

type Config struct {
	ScenarioID string
	Seed       int64
}

type Token struct {
	ID               string
	Class            string
	State            string
	StageID          string
	QueueIndex       int
	ServiceRemaining int
	ArrivalTick      int
}

type Simulator struct {
	rng             *rand.Rand
	seed            int64
	nextID          int
	tokens          []*Token
	paidQueue       []*Token
	freeQueue       []*Token
	anonQueue       []*Token
	inService       []*Token
	snapshots       []Snapshot
	events          []Event
	capacity        int
	serviceTime     int
	rejectThreshold int
}

func Run(cfg Config) (Artifact, error) {
	if cfg.ScenarioID == "" {
		cfg.ScenarioID = ScenarioID
	}
	if cfg.ScenarioID != ScenarioID {
		return Artifact{}, fmt.Errorf("unknown scenario_id: %s", cfg.ScenarioID)
	}

	sim := &Simulator{
		rng:             rand.New(rand.NewSource(cfg.Seed)),
		seed:            cfg.Seed,
		capacity:        3,
		serviceTime:     1,
		rejectThreshold: 12,
	}

	for tick := 0; tick < TickCount; tick++ {
		sim.step(tick)
	}

	metadata := Metadata{
		ScenarioID:      cfg.ScenarioID,
		Seed:            cfg.Seed,
		EngineVersion:   EngineVersion,
		ReplayID:        ReplayID(cfg.ScenarioID, cfg.Seed, EngineVersion),
		TickCount:       TickCount,
		TickDurationMs:  TickDurationMs,
		TotalDurationMs: TotalDurationMs,
	}

	if len(sim.events) == 0 {
		return Artifact{}, errors.New("no events produced")
	}

	return Artifact{
		Metadata:  metadata,
		Snapshots: sim.snapshots,
		Events:    sim.events,
	}, nil
}

func (s *Simulator) step(tick int) {
	s.nextService(tick)
	s.arrivals(tick)
	s.schedule(tick)
	s.updateQueueIndices()
	s.snapshots = append(s.snapshots, Snapshot{
		Tick:   tick,
		TimeMs: tick * TickDurationMs,
		Tokens: s.snapshotTokens(),
		Stages: s.snapshotStages(),
	})
}

func (s *Simulator) nextService(tick int) {
	remaining := s.inService[:0]
	for _, token := range s.inService {
		token.ServiceRemaining--
		if token.ServiceRemaining <= 0 {
			token.State = StateDone
			token.StageID = StageDone
			token.QueueIndex = -1
			s.events = append(s.events, Event{
				Tick:       tick,
				Type:       EventComplete,
				ReasonCode: ReasonServiceComplete,
				TokenID:    token.ID,
				StageID:    StageDone,
				Class:      token.Class,
			})
			continue
		}
		remaining = append(remaining, token)
	}
	s.inService = remaining
}

func (s *Simulator) schedule(tick int) {
	capacityAvailable := s.capacity - len(s.inService)
	for capacityAvailable > 0 {
		token := s.popNextQueued()
		if token == nil {
			return
		}
		token.State = StateProcessing
		token.StageID = StageService
		token.QueueIndex = -1
		token.ServiceRemaining = s.serviceTime
		s.inService = append(s.inService, token)
		s.events = append(s.events, Event{
			Tick:       tick,
			Type:       EventSchedule,
			ReasonCode: ReasonPrioritySchedule,
			TokenID:    token.ID,
			StageID:    StageService,
			Class:      token.Class,
		})
		capacityAvailable--
	}
}

func (s *Simulator) arrivals(tick int) {
	count := arrivalCount(tick)
	classes := s.arrivalClasses(tick, count)
	for _, class := range classes {
		token := s.newToken(class, tick)
		if s.shouldReject(token) {
			token.State = StateRejected
			token.StageID = StageRejected
			token.QueueIndex = -1
			s.events = append(s.events, Event{
				Tick:       tick,
				Type:       EventReject,
				ReasonCode: ReasonRejectOverload,
				TokenID:    token.ID,
				StageID:    StageRejected,
				Class:      token.Class,
			})
			continue
		}

		token.State = StateQueued
		token.StageID = StageQueue
		token.QueueIndex = -1
		s.enqueue(token)
		s.events = append(s.events, Event{
			Tick:       tick,
			Type:       EventQueue,
			ReasonCode: ReasonQueueAdmission,
			TokenID:    token.ID,
			StageID:    StageQueue,
			Class:      token.Class,
		})
	}
}

func (s *Simulator) newToken(class string, tick int) *Token {
	id := fmt.Sprintf("T%04d", s.nextID)
	s.nextID++
	token := &Token{
		ID:          id,
		Class:       class,
		ArrivalTick: tick,
		QueueIndex:  -1,
	}
	s.tokens = append(s.tokens, token)
	return token
}

func (s *Simulator) enqueue(token *Token) {
	switch token.Class {
	case ClassPaid:
		s.paidQueue = append(s.paidQueue, token)
	case ClassFree:
		s.freeQueue = append(s.freeQueue, token)
	default:
		s.anonQueue = append(s.anonQueue, token)
	}
}

func (s *Simulator) popNextQueued() *Token {
	if len(s.paidQueue) > 0 {
		token := s.paidQueue[0]
		s.paidQueue = s.paidQueue[1:]
		return token
	}
	if len(s.freeQueue) > 0 {
		token := s.freeQueue[0]
		s.freeQueue = s.freeQueue[1:]
		return token
	}
	if len(s.anonQueue) > 0 {
		token := s.anonQueue[0]
		s.anonQueue = s.anonQueue[1:]
		return token
	}
	return nil
}

func (s *Simulator) shouldReject(token *Token) bool {
	if token.Class != ClassAnon {
		return false
	}
	queueLength := len(s.paidQueue) + len(s.freeQueue) + len(s.anonQueue)
	return queueLength >= s.rejectThreshold
}

func (s *Simulator) updateQueueIndices() {
	for _, token := range s.tokens {
		if token.State == StateQueued {
			token.QueueIndex = -1
		}
	}

	index := 0
	for _, token := range s.paidQueue {
		token.QueueIndex = index
		index++
	}
	for _, token := range s.freeQueue {
		token.QueueIndex = index
		index++
	}
	for _, token := range s.anonQueue {
		token.QueueIndex = index
		index++
	}
}

func (s *Simulator) snapshotTokens() []TokenState {
	states := make([]TokenState, 0, len(s.tokens))
	for _, token := range s.tokens {
		states = append(states, TokenState{
			ID:               token.ID,
			Class:            token.Class,
			State:            token.State,
			StageID:          token.StageID,
			QueueIndex:       token.QueueIndex,
			ServiceRemaining: token.ServiceRemaining,
		})
	}
	return states
}

func (s *Simulator) snapshotStages() []StageState {
	queueLength := len(s.paidQueue) + len(s.freeQueue) + len(s.anonQueue)
	return []StageState{
		{
			ID:            StageQueue,
			QueueLength:   queueLength,
			CapacityUsed:  0,
			CapacityTotal: 0,
		},
		{
			ID:            StageService,
			QueueLength:   0,
			CapacityUsed:  len(s.inService),
			CapacityTotal: s.capacity,
		},
		{
			ID:            StageDone,
			QueueLength:   0,
			CapacityUsed:  0,
			CapacityTotal: 0,
		},
		{
			ID:            StageRejected,
			QueueLength:   0,
			CapacityUsed:  0,
			CapacityTotal: 0,
		},
	}
}

func arrivalCount(tick int) int {
	switch {
	case tick < 110:
		return 1
	case tick < 150:
		return 2
	case tick < 180:
		return 4
	case tick < 210:
		return 3
	default:
		return 1
	}
}

func (s *Simulator) arrivalClasses(tick int, count int) []string {
	classes := make([]string, 0, count)
	for i := 0; i < count; i++ {
		classes = append(classes, pickClass(s.rng))
	}
	if count >= 2 && tick >= 150 && tick <= 190 {
		classes[0] = ClassPaid
		classes[1] = ClassFree
	}
	return classes
}

func pickClass(rng *rand.Rand) string {
	r := rng.Float64()
	switch {
	case r < 0.55:
		return ClassAnon
	case r < 0.85:
		return ClassFree
	default:
		return ClassPaid
	}
}
