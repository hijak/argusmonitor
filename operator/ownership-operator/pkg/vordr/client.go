package vordr

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

type Client struct {
	BaseURL    string
	Token      string
	HTTPClient *http.Client
}

type TargetRef struct {
	Type string `json:"type,omitempty"`
	Ref  string `json:"ref,omitempty"`
}

type IngestPayload struct {
	Message   string         `json:"message"`
	Severity  string         `json:"severity,omitempty"`
	Host      string         `json:"host,omitempty"`
	Service   string         `json:"service,omitempty"`
	Metadata  map[string]any `json:"metadata,omitempty"`
	Ownership map[string]any `json:"ownership,omitempty"`
}

func (c *Client) endpoint(path string) string {
	return strings.TrimRight(c.BaseURL, "/") + path
}

func (c *Client) client() *http.Client {
	if c.HTTPClient != nil {
		return c.HTTPClient
	}
	return &http.Client{Timeout: 15 * time.Second}
}

func (c *Client) IngestAlert(ctx context.Context, payload IngestPayload) error {
	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.endpoint("/api/alerts/ingest"), bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	if c.Token != "" {
		req.Header.Set("Authorization", "Bearer "+c.Token)
	}
	resp, err := c.client().Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		data, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
		return fmt.Errorf("vordr ingest failed: %s: %s", resp.Status, strings.TrimSpace(string(data)))
	}
	return nil
}
