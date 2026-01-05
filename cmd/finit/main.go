package main

import (
	"flag"
	"fmt"
	"os"
	"path/filepath"

	"finit/engine"
)

func main() {
	scenarioID := flag.String("scenario_id", engine.ScenarioID, "scenario id")
	seed := flag.Int64("seed", 1, "random seed")
	out := flag.String("out", "artifacts/run.json", "output file path")
	flag.Parse()

	artifact, err := engine.Run(engine.Config{
		ScenarioID: *scenarioID,
		Seed:       *seed,
	})
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}

	outPath := *out
	if dir := filepath.Dir(outPath); dir != "." {
		if err := os.MkdirAll(dir, 0o755); err != nil {
			fmt.Fprintln(os.Stderr, err)
			os.Exit(1)
		}
	}

	if err := engine.WriteArtifact(outPath, artifact); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}

	fmt.Printf("wrote %s (replay_id=%s)\n", outPath, artifact.Metadata.ReplayID)
}
