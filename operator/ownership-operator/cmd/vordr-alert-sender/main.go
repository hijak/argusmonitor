package main

import (
	"context"
	"flag"
	"fmt"
	"os"

	"github.com/jack/k8s-ownership-operator/pkg/bridge"
	"github.com/jack/k8s-ownership-operator/pkg/vordr"
)

func main() {
	var (
		baseURL = flag.String("base-url", envOr("VORDR_BASE_URL", "http://127.0.0.1:8000"), "Vordr base URL")
		token = flag.String("token", os.Getenv("VORDR_TOKEN"), "Vordr bearer token")
		message = flag.String("message", "ownership operator test alert", "Alert message")
		severity = flag.String("severity", "warning", "Alert severity")
		host = flag.String("host", "", "Host")
		service = flag.String("service", "", "Service")
		alertName = flag.String("alert-name", "", "Alert name")
		namespace = flag.String("namespace", "", "Kubernetes namespace")
		primaryType = flag.String("primary-type", "user", "Primary owner type")
		primaryRef = flag.String("primary-ref", "", "Primary owner ref")
		secondaryType = flag.String("secondary-type", "", "Secondary owner type")
		secondaryRef = flag.String("secondary-ref", "", "Secondary owner ref")
		escalation = flag.String("escalation-policy", "", "Escalation policy ref")
		source = flag.String("source", "k8s-ownership-operator", "Ownership source")
	)
	flag.Parse()

	if *token == "" {
		fmt.Fprintln(os.Stderr, "VORDR_TOKEN is required")
		os.Exit(2)
	}
	if *primaryRef == "" {
		fmt.Fprintln(os.Stderr, "primary-ref is required")
		os.Exit(2)
	}

	payload := bridge.BuildIngestPayload(
		*message,
		*severity,
		*host,
		*service,
		*alertName,
		*namespace,
		bridge.ResolvedOwner{
			PrimaryType:      *primaryType,
			PrimaryRef:       *primaryRef,
			SecondaryType:    *secondaryType,
			SecondaryRef:     *secondaryRef,
			EscalationPolicy: *escalation,
			Source:           *source,
		},
		map[string]any{"bridge": "vordr-alert-sender"},
	)

	client := &vordr.Client{BaseURL: *baseURL, Token: *token}
	if err := client.IngestAlert(context.Background(), payload); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	fmt.Println("alert sent")
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
