package agentcli

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestCommandsJSONIncludesAgentGuidance(t *testing.T) {
	var stdout bytes.Buffer
	code := Execute([]string{"commands", "show", "roast", "--json"}, &stdout, &bytes.Buffer{})
	if code != 0 {
		t.Fatalf("Execute returned %d", code)
	}

	var payload CommandInfo
	if err := json.Unmarshal(stdout.Bytes(), &payload); err != nil {
		t.Fatal(err)
	}
	if payload.Name != "roast" {
		t.Fatalf("expected roast command, got %q", payload.Name)
	}
	if payload.AgentGuidance == "" || payload.ResponseSemantics == "" {
		t.Fatalf("expected agent guidance and response semantics in catalog")
	}
}

func TestAuthStatusDoesNotContactServer(t *testing.T) {
	var stdout bytes.Buffer
	code := Execute([]string{"auth", "status", "--json"}, &stdout, &bytes.Buffer{})
	if code != 0 {
		t.Fatalf("Execute returned %d", code)
	}

	var payload map[string]any
	if err := json.Unmarshal(stdout.Bytes(), &payload); err != nil {
		t.Fatal(err)
	}
	if payload["host"] != DefaultHost {
		t.Fatalf("expected default host %q, got %v", DefaultHost, payload["host"])
	}
}

func TestScoreCommandCallsScanAPI(t *testing.T) {
	var calledPath string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calledPath = r.URL.Path
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{
			"metrics":{"username":"DemoDev"},
			"scoring":{
				"final_score":68,
				"tier":"NPC",
				"tier_label":"普通账号",
				"sub_scores":{"contribution_quality":20},
				"red_flags":[]
			},
			"cached":false
		}`))
	}))
	defer server.Close()

	var stdout bytes.Buffer
	code := Execute([]string{"score", "DemoDev", "--host", server.URL, "-o", "json"}, &stdout, &bytes.Buffer{})
	if code != 0 {
		t.Fatalf("Execute returned %d", code)
	}
	if calledPath != "/api/scan" {
		t.Fatalf("expected /api/scan, got %q", calledPath)
	}

	var payload map[string]any
	if err := json.Unmarshal(stdout.Bytes(), &payload); err != nil {
		t.Fatal(err)
	}
	if payload["final_score"] != float64(68) {
		t.Fatalf("unexpected score summary: %#v", payload)
	}
}
