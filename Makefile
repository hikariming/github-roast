GO ?= go
BINDIR ?= bin
DISTDIR ?= dist
CLI_BIN ?= $(BINDIR)/github-roast
VERSION ?= $(shell git describe --tags --always --dirty 2>/dev/null || printf dev)
COMMIT ?= $(shell git rev-parse --short=12 HEAD 2>/dev/null || printf none)
BUILD_DATE ?= $(shell git show -s --format=%cI HEAD 2>/dev/null || printf unknown)
LDFLAGS := -X 'github.com/hikariming/github-roast/internal/agentcli.Version=$(VERSION)' \
	-X 'github.com/hikariming/github-roast/internal/agentcli.Commit=$(COMMIT)' \
	-X 'github.com/hikariming/github-roast/internal/agentcli.Date=$(BUILD_DATE)'

.PHONY: cli-build cli-build-all cli-test cli-clean

cli-build:
	mkdir -p "$(BINDIR)"
	$(GO) build -trimpath -ldflags "$(LDFLAGS)" -o "$(CLI_BIN)" ./cmd/github-roast

cli-build-all:
	mkdir -p "$(DISTDIR)"
	GOOS=darwin GOARCH=arm64 $(GO) build -trimpath -ldflags "$(LDFLAGS)" -o "$(DISTDIR)/github-roast-darwin-arm64" ./cmd/github-roast
	GOOS=darwin GOARCH=amd64 $(GO) build -trimpath -ldflags "$(LDFLAGS)" -o "$(DISTDIR)/github-roast-darwin-amd64" ./cmd/github-roast
	GOOS=linux GOARCH=arm64 $(GO) build -trimpath -ldflags "$(LDFLAGS)" -o "$(DISTDIR)/github-roast-linux-arm64" ./cmd/github-roast
	GOOS=linux GOARCH=amd64 $(GO) build -trimpath -ldflags "$(LDFLAGS)" -o "$(DISTDIR)/github-roast-linux-amd64" ./cmd/github-roast
	GOOS=windows GOARCH=amd64 $(GO) build -trimpath -ldflags "$(LDFLAGS)" -o "$(DISTDIR)/github-roast-windows-amd64.exe" ./cmd/github-roast

cli-test:
	$(GO) test ./internal/agentcli

cli-clean:
	rm -rf "$(BINDIR)" "$(DISTDIR)"
