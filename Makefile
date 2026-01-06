.PHONY: lint lint-go lint-ui

lint: lint-go lint-ui

lint-go:
	./scripts/lint-go.sh

lint-ui:
	./scripts/lint-ui.sh
