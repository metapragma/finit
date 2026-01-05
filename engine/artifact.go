package engine

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
)

func ReplayID(scenarioID string, seed int64, version string) string {
	source := fmt.Sprintf("%s|%d|%s", scenarioID, seed, version)
	hash := sha256.Sum256([]byte(source))
	return hex.EncodeToString(hash[:])
}

func WriteArtifact(path string, artifact Artifact) error {
	data, err := json.MarshalIndent(artifact, "", "  ")
	if err != nil {
		return err
	}
	data = append(data, '\n')
	return os.WriteFile(path, data, 0o644)
}
